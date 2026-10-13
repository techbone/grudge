// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IERC721Owner {
    function ownerOf(uint256 id) external view returns (address);
}

/// @title Grudge
/// @notice Chogs prank other Chogs. All state is keyed by Chog Genesis token id, and ownership
///         is read from the collection on every call, so a Chog's scars, beefs and open paybacks
///         belong to whoever holds it now.
contract Grudge {
    // ───────────────────────────── constants ─────────────────────────────

    uint256 public constant MAX_ID = 1969; // Chog Genesis ids are 1..1969
    uint8 public constant MOVES_PER_DAY = 3;
    uint8 public constant SLOTS = 8;
    uint8 public constant KINDS = 5; // graffiti, hat steal, stink cloud, tomato, googly eyes
    uint8 public constant MAX_HEAT = 3;
    uint32 public constant PAYBACK_WINDOW = 3 days;
    uint32 public constant BOUNTY_LOCK = 3 days;
    uint16 public constant MAX_BOUNTY_FEE_BPS = 2000;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    IERC721Owner public immutable chog;
    address public immutable token; // $CHOG

    // ───────────────────────────── state ─────────────────────────────

    struct Scar {
        uint16 by; // attacker token id, 0 = empty slot
        uint8 kind;
        bool heavy; // landed as a payback
        uint32 at;
    }

    struct Stats {
        uint32 day; // day index `used` refers to
        uint8 used; // moves used on `day`
        uint8 next; // next scar slot (ring)
        uint16 landed; // pranks + paybacks landed
        uint16 received; // scars received
        uint32 notoriety;
    }

    struct Beef {
        uint8 heat; // as of `lastAt`, decays 1 per day without contact
        uint32 lastAt;
    }

    struct Bounty {
        address funder;
        uint96 amount;
        uint32 createdAt;
    }

    mapping(uint256 => Stats) internal _stats;
    mapping(uint256 => Scar[8]) internal _scars;
    mapping(bytes32 => Beef) internal _beefs; // unordered pair
    mapping(uint256 => mapping(uint256 => uint32)) public paybackUntil; // victim => attacker => deadline
    mapping(uint256 => mapping(uint256 => uint32)) public lastPrankDay; // from => to => day + 1
    mapping(uint256 => mapping(uint256 => bool)) public truceOffered; // proposer => other
    mapping(uint256 => Bounty) public bounties; // target => bounty (one at a time)

    address public owner;
    uint128 public scrubPrice;
    uint128 public trucePrice;
    uint16 public bountyFeeBps;

    // ───────────────────────────── events ─────────────────────────────

    event Pranked(uint16 indexed from, uint16 indexed to, uint8 kind, bool heavy, uint8 slot);
    event Scrubbed(uint16 indexed id, uint8 slot);
    event TruceOffered(uint16 indexed from, uint16 indexed to);
    event Truce(uint16 indexed a, uint16 indexed b);
    event BountyPosted(uint16 indexed target, address indexed funder, uint256 amount);
    event BountyClaimed(uint16 indexed target, uint16 indexed by, address indexed hunter, uint256 paid);
    event BountyCancelled(uint16 indexed target);
    event PricesSet(uint256 scrub, uint256 truce, uint16 bountyFeeBps);
    event OwnerSet(address owner);

    // ───────────────────────────── errors ─────────────────────────────

    error BadId();
    error BadKind();
    error BadSlot();
    error NotOwner();
    error SameOwner();
    error OutOfMoves();
    error AlreadyPrankedToday();
    error NoPayback();
    error EmptySlot();
    error AlreadyOffered();
    error BountyOpen();
    error NoBounty();
    error BountyLocked();
    error TooHigh();
    error TransferFailed();

    constructor(address chog_, address token_, uint128 scrubPrice_, uint128 trucePrice_, uint16 bountyFeeBps_) {
        if (bountyFeeBps_ > MAX_BOUNTY_FEE_BPS) revert TooHigh();
        chog = IERC721Owner(chog_);
        token = token_;
        owner = msg.sender;
        scrubPrice = scrubPrice_;
        trucePrice = trucePrice_;
        bountyFeeBps = bountyFeeBps_;
        emit OwnerSet(msg.sender);
        emit PricesSet(scrubPrice_, trucePrice_, bountyFeeBps_);
    }

    // ───────────────────────────── pranks ─────────────────────────────

    /// @notice Spend one of today's moves to scar `to`. Opens a payback for `to` against `from`.
    function prank(uint16 from, uint16 to, uint8 kind) external {
        _checkPair(from, to);
        if (kind >= KINDS) revert BadKind();

        uint32 today = _today();
        Stats storage s = _stats[from];
        if (s.day != today) {
            s.day = today;
            s.used = 0;
        }
        if (s.used >= MOVES_PER_DAY) revert OutOfMoves();
        if (lastPrankDay[from][to] == today + 1) revert AlreadyPrankedToday();
        s.used++;
        lastPrankDay[from][to] = today + 1;

        paybackUntil[to][from] = uint32(block.timestamp) + PAYBACK_WINDOW;
        _land(from, to, kind, false, 1, 1);
    }

    /// @notice Hit back at a Chog that pranked yours. Free, heavy, and it doesn't open a counter-payback.
    function payback(uint16 from, uint16 to, uint8 kind) external {
        _checkPair(from, to);
        if (kind >= KINDS) revert BadKind();
        if (paybackUntil[from][to] < block.timestamp) revert NoPayback();
        delete paybackUntil[from][to];
        _land(from, to, kind, true, 2, 2);
    }

    function _land(uint16 from, uint16 to, uint8 kind, bool heavy, uint8 heatUp, uint32 points) internal {
        Stats storage t = _stats[to];
        uint8 slot = t.next;
        _scars[to][slot] = Scar({by: from, kind: kind, heavy: heavy, at: uint32(block.timestamp)});
        t.next = (slot + 1) % SLOTS;
        t.received++;

        Stats storage f = _stats[from];
        f.landed++;
        f.notoriety += points;

        Beef storage b = _beefs[_pairKey(from, to)];
        uint8 h = _decayed(b) + heatUp;
        b.heat = h > MAX_HEAT ? MAX_HEAT : h;
        b.lastAt = uint32(block.timestamp);

        emit Pranked(from, to, kind, heavy, slot);

        Bounty memory bounty = bounties[to];
        if (bounty.amount != 0 && bounty.funder != msg.sender) {
            delete bounties[to];
            f.notoriety += 2;
            uint256 fee = (uint256(bounty.amount) * bountyFeeBps) / 10_000;
            uint256 paid = bounty.amount - fee;
            if (fee != 0) _send(DEAD, fee);
            _send(msg.sender, paid);
            emit BountyClaimed(to, from, msg.sender, paid);
        }
    }

    // ───────────────────────────── $CHOG sinks ─────────────────────────────

    /// @notice Burn $CHOG to clear one scar from your Chog.
    function scrub(uint16 id, uint8 slot) external {
        _checkOwner(id);
        if (slot >= SLOTS) revert BadSlot();
        if (_scars[id][slot].by == 0) revert EmptySlot();
        delete _scars[id][slot];
        _burnFrom(msg.sender, scrubPrice);
        emit Scrubbed(id, slot);
    }

    /// @notice Burn $CHOG to offer `other` a truce. If `other` already offered one, this accepts it:
    ///         heat drops to zero and open paybacks between the two are voided.
    function truce(uint16 mine, uint16 other) external {
        _checkPair(mine, other);
        if (truceOffered[mine][other]) revert AlreadyOffered();
        _burnFrom(msg.sender, trucePrice);
        if (truceOffered[other][mine]) {
            delete truceOffered[other][mine];
            delete truceOffered[mine][other];
            delete _beefs[_pairKey(mine, other)];
            delete paybackUntil[mine][other];
            delete paybackUntil[other][mine];
            emit Truce(other, mine);
        } else {
            truceOffered[mine][other] = true;
            emit TruceOffered(mine, other);
        }
    }

    /// @notice Escrow $CHOG on `target`. The next Chog to prank it (from a wallet other than the funder)
    ///         collects it, minus a burned fee. Doesn't require holding a Chog.
    function postBounty(uint16 target, uint96 amount) external {
        _checkId(target);
        if (amount == 0) revert NoBounty();
        if (bounties[target].amount != 0) revert BountyOpen();
        bounties[target] = Bounty({funder: msg.sender, amount: amount, createdAt: uint32(block.timestamp)});
        _pull(msg.sender, amount);
        emit BountyPosted(target, msg.sender, amount);
    }

    /// @notice Funder takes an unclaimed bounty back once BOUNTY_LOCK has passed.
    function cancelBounty(uint16 target) external {
        Bounty memory b = bounties[target];
        if (b.amount == 0 || b.funder != msg.sender) revert NoBounty();
        if (block.timestamp < uint256(b.createdAt) + BOUNTY_LOCK) revert BountyLocked();
        delete bounties[target];
        _send(msg.sender, b.amount);
        emit BountyCancelled(target);
    }

    // ───────────────────────────── views ─────────────────────────────

    function stats(uint16 id) external view returns (Stats memory) {
        return _stats[id];
    }

    function scars(uint16 id) external view returns (Scar[8] memory) {
        return _scars[id];
    }

    /// @notice Moves left today for `id`.
    function movesLeft(uint16 id) public view returns (uint8) {
        Stats memory s = _stats[id];
        return s.day == _today() ? MOVES_PER_DAY - s.used : MOVES_PER_DAY;
    }

    /// @notice Current heat between two Chogs, with decay applied.
    function heat(uint16 a, uint16 b) external view returns (uint8) {
        return _decayed(_beefs[_pairKey(a, b)]);
    }

    /// @notice Paged read for the Wall: stats and scars for ids [start, start + count).
    function getChogs(uint16 start, uint16 count)
        external
        view
        returns (Stats[] memory stats_, Scar[8][] memory scars_)
    {
        stats_ = new Stats[](count);
        scars_ = new Scar[8][](count);
        for (uint256 i; i < count; ++i) {
            uint256 id = uint256(start) + i;
            if (id == 0 || id > MAX_ID) continue;
            stats_[i] = _stats[id];
            scars_[i] = _scars[id];
        }
    }

    // ───────────────────────────── admin ─────────────────────────────

    function setPrices(uint128 scrub_, uint128 truce_, uint16 bountyFeeBps_) external {
        if (msg.sender != owner) revert NotOwner();
        if (bountyFeeBps_ > MAX_BOUNTY_FEE_BPS) revert TooHigh();
        scrubPrice = scrub_;
        trucePrice = truce_;
        bountyFeeBps = bountyFeeBps_;
        emit PricesSet(scrub_, truce_, bountyFeeBps_);
    }

    function setOwner(address owner_) external {
        if (msg.sender != owner) revert NotOwner();
        owner = owner_;
        emit OwnerSet(owner_);
    }

    // ───────────────────────────── internals ─────────────────────────────

    function _today() internal view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }

    function _checkId(uint256 id) internal pure {
        if (id == 0 || id > MAX_ID) revert BadId();
    }

    function _checkOwner(uint16 id) internal view {
        _checkId(id);
        if (chog.ownerOf(id) != msg.sender) revert NotOwner();
    }

    /// @dev Caller owns `mine`, and `other` is a different Chog held by a different wallet.
    function _checkPair(uint16 mine, uint16 other) internal view {
        _checkOwner(mine);
        _checkId(other);
        if (chog.ownerOf(other) == msg.sender) revert SameOwner();
    }

    function _pairKey(uint16 a, uint16 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encode(a, b)) : keccak256(abi.encode(b, a));
    }

    function _decayed(Beef memory b) internal view returns (uint8) {
        if (b.heat == 0) return 0;
        uint256 days_ = (block.timestamp - b.lastAt) / 1 days;
        return days_ >= b.heat ? 0 : b.heat - uint8(days_);
    }

    function _burnFrom(address from, uint256 amount) internal {
        if (amount == 0) return;
        _call(abi.encodeWithSelector(0x23b872dd, from, DEAD, amount)); // transferFrom
    }

    function _pull(address from, uint256 amount) internal {
        _call(abi.encodeWithSelector(0x23b872dd, from, address(this), amount)); // transferFrom
    }

    function _send(address to, uint256 amount) internal {
        _call(abi.encodeWithSelector(0xa9059cbb, to, amount)); // transfer
    }

    function _call(bytes memory data) internal {
        (bool ok, bytes memory ret) = token.call(data);
        if (!ok || (ret.length != 0 && !abi.decode(ret, (bool)))) revert TransferFailed();
    }
}
