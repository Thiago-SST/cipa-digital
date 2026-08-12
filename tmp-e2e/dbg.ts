import { makeCaller } from "./h.ts";
const T=(await Bun.file("/tmp/e2e/token.txt").text()).trim();
const A=makeCaller("admin.functions.ts",{token:T});
console.log(JSON.stringify(await A("getElection","GET",{id:"2e1cfb83-a0ed-4247-9673-9d7b6e2d2a13"})).slice(0,400));
