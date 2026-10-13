import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { activeChain, monad, monadLocal } from "./chains";

export const config = createConfig({
  chains: [activeChain],
  connectors: [injected()],
  transports: { [monad.id]: http(), [monadLocal.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
