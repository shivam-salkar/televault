import { TelegramClient, sessions } from "teleproto";
import { createInterface } from "node:readline/promises";
import dotenv from "dotenv";

dotenv.config();
const rl = createInterface({ input: process.stdin, output: process.stdout });
const apiId = Number(process.env.APP_ID);
const apiHash = String(process.env.API_HASH);
const session = new sessions.StringSession("");

const client = new TelegramClient(session, apiId, apiHash, {
  connectionRetries: 5,
});

await client.start({
  phoneNumber: () => rl.question("Phone: "),
  password: () => rl.question("2FA password: "),
  phoneCode: () => rl.question("Code: "),
  onError: console.error,
});

console.log(await client.getMe());
console.log("Session string:", client.session.save());

rl.close();
