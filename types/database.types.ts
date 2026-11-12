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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      checkout_drafts: {
        Row: {
          completed_at: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          email: string | null
          expires_at: string
          id: string
          items: Json
          locale: Database["public"]["Enums"]["locale_code"]
          prices_include_vat: boolean
          shipping_amount: number
          status: string
          stripe_session_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          user_id: string | null
          vat_rate: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          expires_at?: string
          id?: string
          items: Json
          locale?: Database["public"]["Enums"]["locale_code"]
          prices_include_vat: boolean
          shipping_amount?: number
          status?: string
          stripe_session_id?: string | null
          subtotal: number
          tax_amount?: number
          total: number
          user_id?: string | null
          vat_rate: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          email?: string | null
          expires_at?: string
          id?: string
          items?: Json
          locale?: Database["public"]["Enums"]["locale_code"]
          prices_include_vat?: boolean
          shipping_amount?: number
          status?: string
          stripe_session_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          user_id?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          id: string
          is_handled: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          message: string
          name: string
          phone: string | null
          subject: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          id?: string
          is_handled?: boolean
          locale?: Database["public"]["Enums"]["locale_code"]
          message: string
          name: string
          phone?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          id?: string
          is_handled?: boolean
          locale?: Database["public"]["Enums"]["locale_code"]
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_campaign_recipients: {
        Row: {
          campaign_id: string
          email: string
          error: string | null
          id: number
          locale: Database["public"]["Enums"]["locale_code"]
          resend_message_id: string | null
          sent_at: string | null
          status: string
          subscriber_id: string | null
        }
        Insert: {
          campaign_id: string
          email: string
          error?: string | null
          id?: never
          locale: Database["public"]["Enums"]["locale_code"]
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          subscriber_id?: string | null
        }
        Update: {
          campaign_id?: string
          email?: string
          error?: string | null
          id?: never
          locale?: Database["public"]["Enums"]["locale_code"]
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaign_recipients_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "newsletter_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          body_html: Json
          body_text: Json
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          name: string
          preheader: Json
          recipients_count: number
          scheduled_at: string | null
          segment: Json
          sent_at: string | null
          sent_count: number
          status: string
          subject: Json
          updated_at: string
        }
        Insert: {
          body_html?: Json
          body_text?: Json
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          name: string
          preheader?: Json
          recipients_count?: number
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: Json
          updated_at?: string
        }
        Update: {
          body_html?: Json
          body_text?: Json
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          name?: string
          preheader?: Json
          recipients_count?: number
          scheduled_at?: string | null
          segment?: Json
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: Json
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          error: string | null
          id: number
          kind: string
          order_id: string | null
          resend_message_id: string | null
          status: string
          to_email: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: never
          kind: string
          order_id?: string | null
          resend_message_id?: string | null
          status?: string
          to_email: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: never
          kind?: string
          order_id?: string | null
          resend_message_id?: string | null
          status?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirm_token: string | null
          confirmed_at: string | null
          created_at: string
          email: string
          id: string
          locale: Database["public"]["Enums"]["locale_code"]
          source: string
          status: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirm_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email: string
          id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          source?: string
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirm_token?: string | null
          confirmed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          source?: string
          status?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      order_item_costs: {
        Row: {
          cost_missing: boolean
          line_production_cost: number
          order_item_id: string
          unit_production_price: number
        }
        Insert: {
          cost_missing?: boolean
          line_production_cost: number
          order_item_id: string
          unit_production_price: number
        }
        Update: {
          cost_missing?: boolean
          line_production_cost?: number
          order_item_id?: string
          unit_production_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_item_costs_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          image_path: string | null
          line_net: number
          line_tax: number
          line_total: number
          order_id: string
          product_id: string | null
          product_name: Json
          product_slug: Json | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_net: number
          line_tax?: number
          line_total: number
          order_id: string
          product_id?: string | null
          product_name: Json
          product_slug?: Json | null
          quantity: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string | null
          line_net?: number
          line_tax?: number
          line_total?: number
          order_id?: string
          product_id?: string | null
          product_name?: Json
          product_slug?: Json | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: number
          order_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: never
          order_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: never
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          customer_notified_at: string | null
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          note: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          customer_notified_at?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          customer_notified_at?: string | null
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          note?: string | null
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          cancelled_at: string | null
          carrier: string | null
          checkout_draft_id: string | null
          completed_at: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          customer_name: string | null
          email: string
          id: string
          locale: Database["public"]["Enums"]["locale_code"]
          needs_review: boolean
          order_number: number
          paid_at: string | null
          payment_method_type: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          prices_include_vat: boolean
          review_reason: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_amount: number
          status: Database["public"]["Enums"]["order_status"]
          stock_committed: boolean
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
          vat_rate: number
        }
        Insert: {
          billing_address?: Json | null
          cancelled_at?: string | null
          carrier?: string | null
          checkout_draft_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          customer_name?: string | null
          email: string
          id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          needs_review?: boolean
          order_number?: never
          paid_at?: string | null
          payment_method_type?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          prices_include_vat: boolean
          review_reason?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_committed?: boolean
          stripe_checkout_session_id: string
          stripe_payment_intent_id?: string | null
          subtotal: number
          tax_amount?: number
          total: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
          vat_rate: number
        }
        Update: {
          billing_address?: Json | null
          cancelled_at?: string | null
          carrier?: string | null
          checkout_draft_id?: string | null
          completed_at?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          customer_name?: string | null
          email?: string
          id?: string
          locale?: Database["public"]["Enums"]["locale_code"]
          needs_review?: boolean
          order_number?: never
          paid_at?: string | null
          payment_method_type?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          prices_include_vat?: boolean
          review_reason?: string | null
          shipped_at?: string | null
          shipping_address?: Json | null
          shipping_amount?: number
          status?: Database["public"]["Enums"]["order_status"]
          stock_committed?: boolean
          stripe_checkout_session_id?: string
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_amount?: number
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_checkout_draft_id_fkey"
            columns: ["checkout_draft_id"]
            isOneToOne: false
            referencedRelation: "checkout_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          product_id: string
          production_price: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          product_id: string
          production_price: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          product_id?: string
          production_price?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: Json
          created_at: string
          height: number | null
          id: string
          position: number
          product_id: string
          size_bytes: number | null
          storage_path: string
          width: number | null
        }
        Insert: {
          alt?: Json
          created_at?: string
          height?: number | null
          id?: string
          position: number
          product_id: string
          size_bytes?: number | null
          storage_path: string
          width?: number | null
        }
        Update: {
          alt?: Json
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          product_id?: string
          size_bytes?: number | null
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_featured: boolean
          long_description: Json
          name: Json
          sale_price: number
          search_vector: unknown
          seo_description: Json
          seo_keywords: Json
          seo_title: Json
          short_description: Json
          sku: string | null
          slug: Json
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          long_description?: Json
          name?: Json
          sale_price: number
          search_vector?: unknown
          seo_description?: Json
          seo_keywords?: Json
          seo_title?: Json
          short_description?: Json
          sku?: string | null
          slug?: Json
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          long_description?: Json
          name?: Json
          sale_price?: number
          search_vector?: unknown
          seo_description?: Json
          seo_keywords?: Json
          seo_title?: Json
          short_description?: Json
          sku?: string | null
          slug?: Json
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_locale: Database["public"]["Enums"]["locale_code"]
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_locale?: Database["public"]["Enums"]["locale_code"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_locale?: Database["public"]["Enums"]["locale_code"]
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      seo_pages: {
        Row: {
          created_at: string
          id: string
          include_in_sitemap: boolean
          keywords: Json
          meta_description: Json
          meta_title: Json
          noindex: boolean
          og_image_path: string | null
          page_key: string
          route_path: string
          sitemap_changefreq: string
          sitemap_priority: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          include_in_sitemap?: boolean
          keywords?: Json
          meta_description?: Json
          meta_title?: Json
          noindex?: boolean
          og_image_path?: string | null
          page_key: string
          route_path: string
          sitemap_changefreq?: string
          sitemap_priority?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          include_in_sitemap?: boolean
          keywords?: Json
          meta_description?: Json
          meta_title?: Json
          noindex?: boolean
          og_image_path?: string | null
          page_key?: string
          route_path?: string
          sitemap_changefreq?: string
          sitemap_priority?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_published: boolean
          key: string
          page: string
          settings: Json
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          key: string
          page: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_published?: boolean
          key?: string
          page?: string
          settings?: Json
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      store_secrets: {
        Row: {
          id: number
          stripe_secret_key: string | null
          stripe_webhook_secret: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: number
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: number
          stripe_secret_key?: string | null
          stripe_webhook_secret?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          contact_email: string | null
          currency: Database["public"]["Enums"]["currency_code"]
          default_locale: Database["public"]["Enums"]["locale_code"]
          free_shipping_threshold: number | null
          id: number
          legal_name: string | null
          low_stock_threshold: number
          max_quantity_per_item: number
          payment_methods: string[]
          prices_include_vat: boolean
          shipping_countries: string[]
          shipping_fee: number
          store_name: string
          stripe_publishable_key: string | null
          updated_at: string
          updated_by: string | null
          vat_number: string | null
          vat_rate: number
        }
        Insert: {
          contact_email?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          default_locale?: Database["public"]["Enums"]["locale_code"]
          free_shipping_threshold?: number | null
          id?: number
          legal_name?: string | null
          low_stock_threshold?: number
          max_quantity_per_item?: number
          payment_methods?: string[]
          prices_include_vat?: boolean
          shipping_countries?: string[]
          shipping_fee?: number
          store_name?: string
          stripe_publishable_key?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          vat_rate?: number
        }
        Update: {
          contact_email?: string | null
          currency?: Database["public"]["Enums"]["currency_code"]
          default_locale?: Database["public"]["Enums"]["locale_code"]
          free_shipping_threshold?: number | null
          id?: number
          legal_name?: string | null
          low_stock_threshold?: number
          max_quantity_per_item?: number
          payment_methods?: string[]
          prices_include_vat?: boolean
          shipping_countries?: string[]
          shipping_fee?: number
          store_name?: string
          stripe_publishable_key?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_number?: string | null
          vat_rate?: number
        }
        Relationships: []
      }
      stripe_events: {
        Row: {
          error: string | null
          id: string
          livemode: boolean
          processed_at: string
          type: string
        }
        Insert: {
          error?: string | null
          id: string
          livemode?: boolean
          processed_at?: string
          type: string
        }
        Update: {
          error?: string | null
          id?: string
          livemode?: boolean
          processed_at?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_campaign_audience: {
        Args: { p_segment: Json }
        Returns: {
          email: string
          locale: Database["public"]["Enums"]["locale_code"]
          subscriber_id: string
          unsubscribe_token: string
        }[]
      }
      admin_customers_overview: {
        Args: never
        Returns: {
          email: string
          full_name: string
          last_order_at: string
          newsletter_status: string
          orders_count: number
          phone: string
          preferred_locale: Database["public"]["Enums"]["locale_code"]
          registered_at: string
          total_spent: number
          user_id: string
        }[]
      }
      admin_dashboard_stats: {
        Args: never
        Returns: {
          active_products: number
          customers: number
          in_progress_orders: number
          low_stock_products: number
          needs_review_orders: number
          pending_orders: number
          subscribers: number
          unhandled_messages: number
        }[]
      }
      admin_get_stripe_secrets_status: {
        Args: never
        Returns: {
          secret_key_configured: boolean
          secret_key_last4: string
          secret_key_mode: string
          updated_at: string
          webhook_secret_configured: boolean
        }[]
      }
      admin_low_stock_products: {
        Args: never
        Returns: {
          is_active: boolean
          name: Json
          product_id: string
          stock: number
        }[]
      }
      admin_reorder_product_images: {
        Args: { p_image_ids: string[]; p_product_id: string }
        Returns: undefined
      }
      admin_sales_report: {
        Args: { p_from: string; p_product_id?: string; p_to: string }
        Returns: {
          cost_missing: boolean
          currency: Database["public"]["Enums"]["currency_code"]
          customer_email: string
          customer_name: string
          line_net: number
          line_production_cost: number
          line_profit: number
          line_tax: number
          line_total: number
          order_date: string
          order_id: string
          order_number: number
          order_status: Database["public"]["Enums"]["order_status"]
          product_id: string
          product_name: Json
          quantity: number
          unit_price: number
          unit_production_price: number
        }[]
      }
      admin_sales_summary: {
        Args: { p_from: string; p_product_id?: string; p_to: string }
        Returns: {
          gross_revenue: number
          lines_cost_missing: number
          net_profit: number
          net_revenue: number
          orders_count: number
          production_costs: number
          shipping_revenue: number
          units_sold: number
          vat_collected: number
        }[]
      }
      admin_set_order_status: {
        Args: {
          p_note?: string
          p_order_id: string
          p_restock?: boolean
          p_status: Database["public"]["Enums"]["order_status"]
        }
        Returns: {
          billing_address: Json | null
          cancelled_at: string | null
          carrier: string | null
          checkout_draft_id: string | null
          completed_at: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          customer_name: string | null
          email: string
          id: string
          locale: Database["public"]["Enums"]["locale_code"]
          needs_review: boolean
          order_number: number
          paid_at: string | null
          payment_method_type: string | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          prices_include_vat: boolean
          review_reason: string | null
          shipped_at: string | null
          shipping_address: Json | null
          shipping_amount: number
          status: Database["public"]["Enums"]["order_status"]
          stock_committed: boolean
          stripe_checkout_session_id: string
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_amount: number
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
          vat_rate: number
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_stripe_secrets: {
        Args: { p_stripe_secret_key?: string; p_stripe_webhook_secret?: string }
        Returns: undefined
      }
      empty_localized: { Args: never; Returns: Json }
      empty_localized_array: { Args: never; Returns: Json }
      finalize_checkout: {
        Args: {
          p_amount_total: number
          p_billing_address: Json
          p_currency: string
          p_customer_name: string
          p_email: string
          p_payment_intent_id: string
          p_payment_method_type?: string
          p_payment_status?: Database["public"]["Enums"]["payment_status"]
          p_phone: string
          p_shipping_address: Json
          p_stripe_session_id: string
        }
        Returns: string
      }
      has_all_locales: { Args: { j: Json }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_service: { Args: never; Returns: boolean }
      is_localized_map: { Args: { j: Json }; Returns: boolean }
      is_localized_string_array: { Args: { j: Json }; Returns: boolean }
      is_localized_text: { Args: { j: Json }; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      is_valid_campaign_segment: { Args: { j: Json }; Returns: boolean }
      is_valid_localized_slug: { Args: { j: Json }; Returns: boolean }
      set_my_newsletter_subscription: {
        Args: {
          p_locale?: Database["public"]["Enums"]["locale_code"]
          p_subscribed: boolean
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "customer"
      currency_code: "CHF" | "EUR"
      locale_code: "es" | "fr" | "de"
      order_status:
        | "pending"
        | "in_progress"
        | "shipped"
        | "completed"
        | "cancelled"
      payment_status: "unpaid" | "paid" | "refunded" | "partially_refunded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "customer"],
      currency_code: ["CHF", "EUR"],
      locale_code: ["es", "fr", "de"],
      order_status: [
        "pending",
        "in_progress",
        "shipped",
        "completed",
        "cancelled",
      ],
      payment_status: ["unpaid", "paid", "refunded", "partially_refunded"],
    },
  },
} as const
