import { ethers } from "ethers";

export default async function handler(req, res) {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: "No address provided" });
  }

  if (!process.env.FUNDER_KEY) {
    return res.status(500).json({ error: "FUNDER_KEY not set" });
  }

  try {
    const provider = new ethers.JsonRpcProvider(
      "https://testnet-rpc.monad.xyz"
    );
    const funder = new ethers.Wallet(process.env.FUNDER_KEY, provider);
    const balance = await provider.getBalance(address);

    if (balance < ethers.parseEther("0.1")) {
      const tx = await funder.sendTransaction({
        to: address,
        value: ethers.parseEther("0.5"),
      });
      // Don't await tx.wait() — return immediately
      return res.status(200).json({ funded: true, tx: tx.hash });
    }

    return res.status(200).json({ funded: false, reason: "Already funded" });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
