export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          acao: string
          ator: string | null
          created_at: string
          detalhes: Json | null
          id: string
          ip: string | null
        }
        Insert: {
          acao: string
          ator?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          ip?: string | null
        }
        Update: {
          acao?: string
          ator?: string | null
          created_at?: string
          detalhes?: Json | null
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      candidates: {
        Row: {
          cargo: string | null
          created_at: string
          election_id: string
          employee_id: string | null
          foto_url: string | null
          id: string
          matricula: string
          nome: string
          numero: number | null
          proposta: string | null
          setor: string | null
          status: Database["public"]["Enums"]["candidate_status"]
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          election_id: string
          employee_id?: string | null
          foto_url?: string | null
          id?: string
          matricula: string
          nome: string
          numero?: number | null
          proposta?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
        }
        Update: {
          cargo?: string | null
          created_at?: string
          election_id?: string
          employee_id?: string | null
          foto_url?: string | null
          id?: string
          matricula?: string
          nome?: string
          numero?: number | null
          proposta?: string | null
          setor?: string | null
          status?: Database["public"]["Enums"]["candidate_status"]
        }
        Relationships: [
          {
            foreignKeyName: "candidates_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      elections: {
        Row: {
          created_at: string
          data_fim_inscricao: string | null
          data_fim_votacao: string | null
          data_inicio_inscricao: string | null
          data_inicio_votacao: string | null
          descricao: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["election_status"]
          updated_at: string
          vagas_suplentes: number
          vagas_titulares: number
        }
        Insert: {
          created_at?: string
          data_fim_inscricao?: string | null
          data_fim_votacao?: string | null
          data_inicio_inscricao?: string | null
          data_inicio_votacao?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["election_status"]
          updated_at?: string
          vagas_suplentes?: number
          vagas_titulares?: number
        }
        Update: {
          created_at?: string
          data_fim_inscricao?: string | null
          data_fim_votacao?: string | null
          data_inicio_inscricao?: string | null
          data_inicio_votacao?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["election_status"]
          updated_at?: string
          vagas_suplentes?: number
          vagas_titulares?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          ativo: boolean
          cargo: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string
          email: string | null
          id: string
          matricula: string
          nome: string
          setor: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento: string
          email?: string | null
          id?: string
          matricula: string
          nome: string
          setor?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string
          email?: string | null
          id?: string
          matricula?: string
          nome?: string
          setor?: string | null
        }
        Relationships: []
      }
      vote_tokens: {
        Row: {
          election_id: string
          employee_id: string
          id: string
          voted_at: string
        }
        Insert: {
          election_id: string
          employee_id: string
          id?: string
          voted_at?: string
        }
        Update: {
          election_id?: string
          employee_id?: string
          id?: string
          voted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_tokens_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "elections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      candidate_status: "pending" | "approved" | "rejected"
      election_status: "draft" | "registration" | "voting" | "closed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      candidate_status: ["pending", "approved", "rejected"],
      election_status: ["draft", "registration", "voting", "closed"],
    },
  },
} as const
