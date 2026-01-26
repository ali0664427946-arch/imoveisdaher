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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          assigned_user_id: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          created_at: string
          external_thread_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string
          next_action_at: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id: string
          next_action_at?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string
          next_action_at?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string
          created_at: string
          ficha_id: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          observation: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["document_status"]
        }
        Insert: {
          category: string
          created_at?: string
          ficha_id: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          observation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
        }
        Update: {
          category?: string
          created_at?: string
          ficha_id?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          observation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["document_status"]
        }
        Relationships: [
          {
            foreignKeyName: "documents_ficha_id_fkey"
            columns: ["ficha_id"]
            isOneToOne: false
            referencedRelation: "fichas"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas: {
        Row: {
          address_cep: string | null
          address_city: string | null
          address_complement: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          ai_analyses: Json[] | null
          analyzed_at: string | null
          analyzed_by: string | null
          birth_date: string | null
          company: string | null
          cpf: string
          created_at: string
          email: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          form_data: Json | null
          full_name: string
          has_pets: boolean | null
          id: string
          income: number | null
          lead_id: string | null
          marital_status: string | null
          observations: string | null
          occupation: string | null
          phone: string
          property_id: string | null
          protocol: string | null
          residents_count: number | null
          rg: string | null
          status: Database["public"]["Enums"]["ficha_status"]
          updated_at: string
        }
        Insert: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_analyses?: Json[] | null
          analyzed_at?: string | null
          analyzed_by?: string | null
          birth_date?: string | null
          company?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          form_data?: Json | null
          full_name: string
          has_pets?: boolean | null
          id?: string
          income?: number | null
          lead_id?: string | null
          marital_status?: string | null
          observations?: string | null
          occupation?: string | null
          phone: string
          property_id?: string | null
          protocol?: string | null
          residents_count?: number | null
          rg?: string | null
          status?: Database["public"]["Enums"]["ficha_status"]
          updated_at?: string
        }
        Update: {
          address_cep?: string | null
          address_city?: string | null
          address_complement?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          ai_analyses?: Json[] | null
          analyzed_at?: string | null
          analyzed_by?: string | null
          birth_date?: string | null
          company?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          form_data?: Json | null
          full_name?: string
          has_pets?: boolean | null
          id?: string
          income?: number | null
          lead_id?: string | null
          marital_status?: string | null
          observations?: string | null
          occupation?: string | null
          phone?: string
          property_id?: string | null
          protocol?: string | null
          residents_count?: number | null
          rg?: string | null
          status?: Database["public"]["Enums"]["ficha_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fichas_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_user_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          origin: string | null
          phone: string | null
          phone_normalized: string | null
          property_id: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          phone_normalized?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          phone_normalized?: string | null
          property_id?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          id: string
          media_url: string | null
          message_type: string | null
          provider: string | null
          provider_payload: Json | null
          sent_status: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          id?: string
          media_url?: string | null
          message_type?: string | null
          provider?: string | null
          provider_payload?: Json | null
          sent_status?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          id?: string
          media_url?: string | null
          message_type?: string | null
          provider?: string | null
          provider_payload?: Json | null
          sent_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string | null
          area: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string
          created_at: string
          description: string | null
          featured: boolean | null
          id: string
          meta_description: string | null
          meta_title: string | null
          neighborhood: string
          origin: Database["public"]["Enums"]["property_origin"]
          origin_id: string | null
          parking: number | null
          price: number
          purpose: Database["public"]["Enums"]["property_purpose"]
          slug: string | null
          state: string
          status: Database["public"]["Enums"]["property_status"]
          title: string
          type: string
          updated_at: string
          url_original: string | null
        }
        Insert: {
          address?: string | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          neighborhood: string
          origin?: Database["public"]["Enums"]["property_origin"]
          origin_id?: string | null
          parking?: number | null
          price: number
          purpose: Database["public"]["Enums"]["property_purpose"]
          slug?: string | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"]
          title: string
          type: string
          updated_at?: string
          url_original?: string | null
        }
        Update: {
          address?: string | null
          area?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          created_at?: string
          description?: string | null
          featured?: boolean | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          neighborhood?: string
          origin?: Database["public"]["Enums"]["property_origin"]
          origin_id?: string | null
          parking?: number | null
          price?: number
          purpose?: Database["public"]["Enums"]["property_purpose"]
          slug?: string | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"]
          title?: string
          type?: string
          updated_at?: string
          url_original?: string | null
        }
        Relationships: []
      }
      property_photos: {
        Row: {
          created_at: string
          id: string
          property_id: string
          sort_order: number | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          sort_order?: number | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          sort_order?: number | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          channel: Database["public"]["Enums"]["conversation_channel"] | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["conversation_channel"] | null
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["conversation_channel"] | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_member: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "agent"
      conversation_channel: "whatsapp" | "olx_chat" | "internal" | "email"
      document_status: "pendente" | "ok" | "reprovado"
      employment_type:
        | "clt"
        | "autonomo"
        | "empresario"
        | "aposentado"
        | "funcionario_publico"
      ficha_status:
        | "pendente"
        | "em_analise"
        | "apto"
        | "nao_apto"
        | "faltando_docs"
      lead_status:
        | "novo"
        | "nao_atendeu"
        | "retornar"
        | "nao_quis_reuniao"
        | "reuniao_marcada"
        | "fechado"
      message_direction: "inbound" | "outbound"
      property_origin: "olx" | "imovelweb" | "import" | "manual"
      property_purpose: "rent" | "sale"
      property_status: "active" | "inactive" | "rented" | "sold"
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
      app_role: ["admin", "agent"],
      conversation_channel: ["whatsapp", "olx_chat", "internal", "email"],
      document_status: ["pendente", "ok", "reprovado"],
      employment_type: [
        "clt",
        "autonomo",
        "empresario",
        "aposentado",
        "funcionario_publico",
      ],
      ficha_status: [
        "pendente",
        "em_analise",
        "apto",
        "nao_apto",
        "faltando_docs",
      ],
      lead_status: [
        "novo",
        "nao_atendeu",
        "retornar",
        "nao_quis_reuniao",
        "reuniao_marcada",
        "fechado",
      ],
      message_direction: ["inbound", "outbound"],
      property_origin: ["olx", "imovelweb", "import", "manual"],
      property_purpose: ["rent", "sale"],
      property_status: ["active", "inactive", "rented", "sold"],
    },
  },
} as const
