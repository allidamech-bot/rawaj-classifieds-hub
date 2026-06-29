import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { UserProfile } from "./auth-types";
import type { AuthStatus } from "./auth-status";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  reason: string | null;
  canAccessAdmin: boolean;
  canAccessOwnerControls: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
