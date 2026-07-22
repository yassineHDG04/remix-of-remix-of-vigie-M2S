export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      assurances: {
        Row: {
          created_at: string;
          id: string;
          nom: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nom: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nom?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      calls: {
        Row: {
          attempt_no: number;
          created_at: string;
          delay_category: Database["public"]["Enums"]["delay_category"] | null;
          delay_reason: string | null;
          dossier_id: string;
          duration_sec: number;
          ended_at: string | null;
          estimated_transport_cost_usd: number;
          estimated_cost_usd: number;
          fallback_reason: string | null;
          id: string;
          models_used: Json;
          outcome: Database["public"]["Enums"]["call_outcome"] | null;
          call_channel_used: string | null;
          provider_connected_at: string | null;
          provider_ref: string | null;
          stage: number;
          started_at: string;
          status: Database["public"]["Enums"]["call_status"];
          voice_engine_used: string | null;
        };
        Insert: {
          attempt_no?: number;
          created_at?: string;
          delay_category?: Database["public"]["Enums"]["delay_category"] | null;
          delay_reason?: string | null;
          dossier_id: string;
          duration_sec?: number;
          ended_at?: string | null;
          estimated_transport_cost_usd?: number;
          estimated_cost_usd?: number;
          fallback_reason?: string | null;
          id?: string;
          models_used?: Json;
          outcome?: Database["public"]["Enums"]["call_outcome"] | null;
          call_channel_used?: string | null;
          provider_connected_at?: string | null;
          provider_ref?: string | null;
          stage: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
          voice_engine_used?: string | null;
        };
        Update: {
          attempt_no?: number;
          created_at?: string;
          delay_category?: Database["public"]["Enums"]["delay_category"] | null;
          delay_reason?: string | null;
          dossier_id?: string;
          duration_sec?: number;
          ended_at?: string | null;
          estimated_transport_cost_usd?: number;
          estimated_cost_usd?: number;
          fallback_reason?: string | null;
          id?: string;
          models_used?: Json;
          outcome?: Database["public"]["Enums"]["call_outcome"] | null;
          call_channel_used?: string | null;
          provider_connected_at?: string | null;
          provider_ref?: string | null;
          stage?: number;
          started_at?: string;
          status?: Database["public"]["Enums"]["call_status"];
          voice_engine_used?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calls_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: false;
            referencedRelation: "dossiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "calls_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: false;
            referencedRelation: "v_dossiers_complets";
            referencedColumns: ["id"];
          },
        ];
      };
      clients: {
        Row: {
          created_at: string;
          id: string;
          nom: string;
          telephone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nom?: string;
          telephone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nom?: string;
          telephone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      constateurs: {
        Row: {
          created_at: string;
          id: string;
          nom: string;
          telephone: string;
          zone: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nom: string;
          telephone: string;
          zone: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nom?: string;
          telephone?: string;
          zone?: string;
        };
        Relationships: [];
      };
      dossiers: {
        Row: {
          arrival_at: string;
          created_at: string;
          current_stage: number;
          deadline_at: string;
          final_category: Database["public"]["Enums"]["delay_category"] | null;
          handoff_acknowledged_at: string | null;
          handoff_acknowledged_by: string | null;
          handoff_reason: string | null;
          id: string;
          next_action_at: string | null;
          sinistre_id: string;
          sla_hours: number;
          stage_answered: number;
          stage_attempts: number;
          status: Database["public"]["Enums"]["dossier_status"];
          updated_at: string;
          validated_at: string | null;
        };
        Insert: {
          arrival_at?: string;
          created_at?: string;
          current_stage?: number;
          deadline_at: string;
          final_category?: Database["public"]["Enums"]["delay_category"] | null;
          handoff_acknowledged_at?: string | null;
          handoff_acknowledged_by?: string | null;
          handoff_reason?: string | null;
          id?: string;
          next_action_at?: string | null;
          sinistre_id: string;
          sla_hours?: number;
          stage_answered?: number;
          stage_attempts?: number;
          status?: Database["public"]["Enums"]["dossier_status"];
          updated_at?: string;
          validated_at?: string | null;
        };
        Update: {
          arrival_at?: string;
          created_at?: string;
          current_stage?: number;
          deadline_at?: string;
          final_category?: Database["public"]["Enums"]["delay_category"] | null;
          handoff_acknowledged_at?: string | null;
          handoff_acknowledged_by?: string | null;
          handoff_reason?: string | null;
          id?: string;
          next_action_at?: string | null;
          sinistre_id?: string;
          sla_hours?: number;
          stage_answered?: number;
          stage_attempts?: number;
          status?: Database["public"]["Enums"]["dossier_status"];
          updated_at?: string;
          validated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dossiers_sinistre_id_fkey";
            columns: ["sinistre_id"];
            isOneToOne: false;
            referencedRelation: "sinistres";
            referencedColumns: ["id"];
          },
        ];
      };
      m2s_webhook_events: {
        Row: {
          dossier_id: string | null;
          error_message: string | null;
          event_id: string;
          payload_sha256: string;
          processed_at: string | null;
          processing_status: string;
          received_at: string;
        };
        Insert: {
          dossier_id?: string | null;
          error_message?: string | null;
          event_id: string;
          payload_sha256: string;
          processed_at?: string | null;
          processing_status?: string;
          received_at?: string;
        };
        Update: {
          dossier_id?: string | null;
          error_message?: string | null;
          event_id?: string;
          payload_sha256?: string;
          processed_at?: string | null;
          processing_status?: string;
          received_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "m2s_webhook_events_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: false;
            referencedRelation: "dossiers";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          must_reset_password: boolean;
          status: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          must_reset_password?: boolean;
          status?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          must_reset_password?: boolean;
          status?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          agent_max_call_seconds: number | null;
          agent_max_response_tokens: number | null;
          agent_max_turns: number | null;
          call_window_end: string;
          call_window_start: string;
          call_channel: string;
          humain_min: number;
          id: number;
          livekit_api_key: string | null;
          livekit_api_secret: string | null;
          livekit_url: string | null;
          max_attempts: number;
          m2s_dossiers_api_url: string;
          m2s_poll_interval_seconds: number;
          m2s_sync_mode: string;
          nb_relances_ia: number;
          llm_model: string;
          openai_api_key: string | null;
          realtime_model: string;
          relance1_min: number;
          relance2_min: number;
          relance3_min: number;
          relance4_min: number;
          retry_interval_min: number;
          selected_whatsapp_id: string | null;
          sip_caller_id: string;
          sip_trunk_id: string;
          sla_hours: number;
          stt_language: string;
          stt_model: string;
          stt_provider: string;
          tts_model: string;
          tts_provider: string;
          tts_voice_id: string;
          updated_at: string;
          vigie_api_base_url: string | null;
          voice_engine: string;
          whatsapp_max_attempts: number;
          zineb_whatsapp: string;
        };
        Insert: {
          agent_max_call_seconds?: number | null;
          agent_max_response_tokens?: number | null;
          agent_max_turns?: number | null;
          call_window_end?: string;
          call_window_start?: string;
          call_channel?: string;
          humain_min?: number;
          id: number;
          livekit_api_key?: string | null;
          livekit_api_secret?: string | null;
          livekit_url?: string | null;
          max_attempts?: number;
          m2s_dossiers_api_url?: string;
          m2s_poll_interval_seconds?: number;
          m2s_sync_mode?: string;
          nb_relances_ia?: number;
          llm_model?: string;
          openai_api_key?: string | null;
          realtime_model?: string;
          relance1_min?: number;
          relance2_min?: number;
          relance3_min?: number;
          relance4_min?: number;
          retry_interval_min?: number;
          selected_whatsapp_id?: string | null;
          sip_caller_id?: string;
          sip_trunk_id?: string;
          sla_hours?: number;
          stt_language?: string;
          stt_model?: string;
          stt_provider?: string;
          tts_model?: string;
          tts_provider?: string;
          tts_voice_id?: string;
          updated_at?: string;
          vigie_api_base_url?: string | null;
          voice_engine?: string;
          whatsapp_max_attempts?: number;
          zineb_whatsapp?: string;
        };
        Update: {
          agent_max_call_seconds?: number | null;
          agent_max_response_tokens?: number | null;
          agent_max_turns?: number | null;
          call_window_end?: string;
          call_window_start?: string;
          call_channel?: string;
          humain_min?: number;
          id?: number;
          livekit_api_key?: string | null;
          livekit_api_secret?: string | null;
          livekit_url?: string | null;
          max_attempts?: number;
          m2s_dossiers_api_url?: string;
          m2s_poll_interval_seconds?: number;
          m2s_sync_mode?: string;
          nb_relances_ia?: number;
          llm_model?: string;
          openai_api_key?: string | null;
          realtime_model?: string;
          relance1_min?: number;
          relance2_min?: number;
          relance3_min?: number;
          relance4_min?: number;
          retry_interval_min?: number;
          selected_whatsapp_id?: string | null;
          sip_caller_id?: string;
          sip_trunk_id?: string;
          sla_hours?: number;
          stt_language?: string;
          stt_model?: string;
          stt_provider?: string;
          tts_model?: string;
          tts_provider?: string;
          tts_voice_id?: string;
          updated_at?: string;
          vigie_api_base_url?: string | null;
          voice_engine?: string;
          whatsapp_max_attempts?: number;
          zineb_whatsapp?: string;
        };
        Relationships: [
          {
            foreignKeyName: "settings_selected_whatsapp_id_fkey";
            columns: ["selected_whatsapp_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      sinistres: {
        Row: {
          assurance_id: string | null;
          client_id: string | null;
          constateur_id: string;
          created_at: string;
          date_sinistre: string | null;
          id: string;
          lieu_sinistre: string;
          ref_m2s: string;
          updated_at: string;
          vehicule_id: string | null;
          zone: string;
        };
        Insert: {
          assurance_id?: string | null;
          client_id?: string | null;
          constateur_id: string;
          created_at?: string;
          date_sinistre?: string | null;
          id?: string;
          lieu_sinistre?: string;
          ref_m2s: string;
          updated_at?: string;
          vehicule_id?: string | null;
          zone?: string;
        };
        Update: {
          assurance_id?: string | null;
          client_id?: string | null;
          constateur_id?: string;
          created_at?: string;
          date_sinistre?: string | null;
          id?: string;
          lieu_sinistre?: string;
          ref_m2s?: string;
          updated_at?: string;
          vehicule_id?: string | null;
          zone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sinistres_assurance_id_fkey";
            columns: ["assurance_id"];
            isOneToOne: false;
            referencedRelation: "assurances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_constateur_id_fkey";
            columns: ["constateur_id"];
            isOneToOne: false;
            referencedRelation: "constateurs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_vehicule_id_fkey";
            columns: ["vehicule_id"];
            isOneToOne: false;
            referencedRelation: "vehicules";
            referencedColumns: ["id"];
          },
        ];
      };
      transcript_turns: {
        Row: {
          call_id: string;
          id: string;
          speaker: Database["public"]["Enums"]["speaker"];
          text: string;
          ts: string;
          turn_no: number;
        };
        Insert: {
          call_id: string;
          id?: string;
          speaker: Database["public"]["Enums"]["speaker"];
          text: string;
          ts?: string;
          turn_no: number;
        };
        Update: {
          call_id?: string;
          id?: string;
          speaker?: Database["public"]["Enums"]["speaker"];
          text?: string;
          ts?: string;
          turn_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: "transcript_turns_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      vehicules: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          matricule: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          matricule?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          matricule?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_contacts: {
        Row: {
          created_at: string;
          id: string;
          label: string;
          number_whatsapp: string;
          updated_at: string;
          whatsapp_phone_number_id: string;
          whatsapp_token: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label?: string;
          number_whatsapp: string;
          updated_at?: string;
          whatsapp_phone_number_id?: string;
          whatsapp_token?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label?: string;
          number_whatsapp?: string;
          updated_at?: string;
          whatsapp_phone_number_id?: string;
          whatsapp_token?: string;
        };
        Relationships: [];
      };
      whatsapp_alerts: {
        Row: {
          accepted_at: string;
          created_at: string;
          delivered_at: string | null;
          dossier_id: string;
          failed_at: string | null;
          failure_reason: string | null;
          id: string;
          instance_id: string;
          last_event_at: string | null;
          last_event_id: string | null;
          m2s_message_id: string;
          read_at: string | null;
          recipient: string;
          sent_at: string | null;
          status: string;
          updated_at: string;
          whatsapp_contact_id: string | null;
        };
        Insert: {
          accepted_at?: string;
          created_at?: string;
          delivered_at?: string | null;
          dossier_id: string;
          failed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          instance_id?: string;
          last_event_at?: string | null;
          last_event_id?: string | null;
          m2s_message_id: string;
          read_at?: string | null;
          recipient?: string;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
          whatsapp_contact_id?: string | null;
        };
        Update: {
          accepted_at?: string;
          created_at?: string;
          delivered_at?: string | null;
          dossier_id?: string;
          failed_at?: string | null;
          failure_reason?: string | null;
          id?: string;
          instance_id?: string;
          last_event_at?: string | null;
          last_event_id?: string | null;
          m2s_message_id?: string;
          read_at?: string | null;
          recipient?: string;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
          whatsapp_contact_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "whatsapp_alerts_dossier_id_fkey";
            columns: ["dossier_id"];
            isOneToOne: true;
            referencedRelation: "dossiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "whatsapp_alerts_whatsapp_contact_id_fkey";
            columns: ["whatsapp_contact_id"];
            isOneToOne: false;
            referencedRelation: "whatsapp_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      v_dossiers_complets: {
        Row: {
          adresse: string | null;
          arrival_at: string | null;
          assurance_id: string | null;
          assure: string | null;
          client_id: string | null;
          constateur_id: string | null;
          constateurs: Json | null;
          created_at: string | null;
          current_stage: number | null;
          date_sinistre: string | null;
          deadline_at: string | null;
          final_category: Database["public"]["Enums"]["delay_category"] | null;
          handoff_acknowledged_at: string | null;
          handoff_acknowledged_by: string | null;
          handoff_reason: string | null;
          id: string | null;
          matricule: string | null;
          next_action_at: string | null;
          nom_assurance: string | null;
          num_tel_client: string | null;
          ref_m2s: string | null;
          sinistre_id: string | null;
          sla_hours: number | null;
          stage_answered: number | null;
          stage_attempts: number | null;
          status: Database["public"]["Enums"]["dossier_status"] | null;
          updated_at: string | null;
          validated_at: string | null;
          vehicule: string | null;
          vehicule_id: string | null;
          zone: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "dossiers_sinistre_id_fkey";
            columns: ["sinistre_id"];
            isOneToOne: false;
            referencedRelation: "sinistres";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_assurance_id_fkey";
            columns: ["assurance_id"];
            isOneToOne: false;
            referencedRelation: "assurances";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_client_id_fkey";
            columns: ["client_id"];
            isOneToOne: false;
            referencedRelation: "clients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_constateur_id_fkey";
            columns: ["constateur_id"];
            isOneToOne: false;
            referencedRelation: "constateurs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sinistres_vehicule_id_fkey";
            columns: ["vehicule_id"];
            isOneToOne: false;
            referencedRelation: "vehicules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      claim_m2s_webhook_event: {
        Args: { p_event_id: string; p_payload_sha256: string };
        Returns: boolean;
      };
      create_dossier_normalise: {
        Args: {
          p_adresse?: string;
          p_arrival_at?: string;
          p_assure?: string;
          p_constateur_id: string;
          p_current_stage?: number;
          p_date_sinistre?: string;
          p_deadline_at?: string;
          p_dossier_id?: string;
          p_final_category?: string;
          p_matricule?: string;
          p_nom_assurance?: string;
          p_num_tel_client?: string;
          p_ref_m2s: string;
          p_sla_hours?: number;
          p_status?: string;
          p_validated_at?: string;
          p_vehicule?: string;
          p_zone?: string;
        };
        Returns: string;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      update_dossier_m2s: {
        Args: {
          p_adresse?: string;
          p_assure?: string;
          p_date_sinistre?: string;
          p_dossier_id: string;
          p_matricule?: string;
          p_nom_assurance?: string;
          p_num_tel_client?: string;
          p_vehicule?: string;
          p_zone?: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "admin" | "superviseur";
      call_outcome: "cause_captee" | "non_joignable" | "hors_sujet" | "refus";
      call_status: "pris" | "non_joignable" | "repondeur" | "refus" | "echec" | "en_cours";
      delay_category:
        | "desaccord_parties"
        | "zone_hors_km"
        | "expertise_en_cours"
        | "pieces_manquantes"
        | "injoignable_tiers"
        | "autre";
      dossier_status: "en_retard" | "valide";
      speaker: "ia" | "constateur";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "superviseur"],
      call_outcome: ["cause_captee", "non_joignable", "hors_sujet", "refus"],
      call_status: ["pris", "non_joignable", "repondeur", "refus", "echec", "en_cours"],
      delay_category: [
        "desaccord_parties",
        "zone_hors_km",
        "expertise_en_cours",
        "pieces_manquantes",
        "injoignable_tiers",
        "autre",
      ],
      dossier_status: ["en_retard", "valide"],
      speaker: ["ia", "constateur"],
    },
  },
} as const;
