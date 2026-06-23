import { useSession } from "@tanstack/react-start/server";

export type VoterSessionData = {
  employeeId?: string;
  electionId?: string;
  nome?: string;
  matricula?: string;
};

export function getVoterSession() {
  const password = process.env.SESSION_SECRET;
  if (!password) {
    throw new Error("SESSION_SECRET não configurado.");
  }
  return useSession<VoterSessionData>({
    password,
    name: "cipa_voter",
    maxAge: 60 * 60 * 2, // 2 horas
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    },
  });
}