export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string
          organization_id: string
          name: string
          type: string
          balance: number
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          type: string
          balance?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          type?: string
          balance?: number
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          avatar_url: string | null
          website: string | null
          organization_id: string | null
          onboarding_completed: boolean | null
          branch_id: string | null
        }
        Insert: {
          id: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          organization_id?: string | null
          onboarding_completed?: boolean | null
          branch_id?: string | null
        }
        Update: {
          id?: string
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          website?: string | null
          organization_id?: string | null
          onboarding_completed?: boolean | null
          branch_id?: string | null
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
          owner_id: string
          settings: Json
          digital_signature_url: string | null
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
          owner_id: string
          settings?: Json
          digital_signature_url?: string | null
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
          owner_id?: string
          settings?: Json
          digital_signature_url?: string | null
        }
      }
      clients: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          address: string | null
          rnc: string | null
          organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          address?: string | null
          rnc?: string | null
          organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          address?: string | null
          rnc?: string | null
          organization_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      providers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          rnc: string | null
          contact_person: string | null
          payment_terms: string | null
          notes: string | null
          organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          rnc?: string | null
          contact_person?: string | null
          payment_terms?: string | null
          notes?: string | null
          organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          rnc?: string | null
          contact_person?: string | null
          payment_terms?: string | null
          notes?: string | null
          organization_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          description: string | null
          price: number
          category: string | null
          organization_id: string
          is_inventory_tracked: boolean | null
          sku: string | null
          unit_of_measure: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price: number
          category?: string | null
          organization_id: string
          is_inventory_tracked?: boolean | null
          sku?: string | null
          unit_of_measure?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price?: number
          category?: string | null
          organization_id?: string
          is_inventory_tracked?: boolean | null
          sku?: string | null
          unit_of_measure?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      provider_bills: {
        Row: {
          id: string
          organization_id: string
          provider_id: string
          account_id: string | null
          bill_number: string
          reference_number: string | null
          subtotal: number
          tax: number
          total: number
          balance: number
          status: string
          due_date: string
          bill_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          provider_id: string
          account_id?: string | null
          bill_number: string
          reference_number?: string | null
          subtotal?: number
          tax?: number
          total?: number
          balance?: number
          status?: string
          due_date: string
          bill_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          provider_id?: string
          account_id?: string | null
          bill_number?: string
          reference_number?: string | null
          subtotal?: number
          tax?: number
          total?: number
          balance?: number
          status?: string
          due_date?: string
          bill_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      provider_payments: {
        Row: {
          id: string
          organization_id: string
          provider_bill_id: string
          provider_id: string
          account_id: string | null
          amount: number
          payment_date: string
          payment_method: string | null
          reference_number: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          provider_bill_id: string
          provider_id: string
          account_id?: string | null
          amount: number
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          provider_bill_id?: string
          provider_id?: string
          account_id?: string | null
          amount?: number
          payment_date?: string
          payment_method?: string | null
          reference_number?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoices: {
        Row: {
          id: string
          invoice_number: string
          client_id: string
          organization_id: string
          subtotal: number
          discount_percentage: number | null
          discount_amount: number | null
          tax: number
          total: number
          balance: number | null
          status: string
          due_date: string
          issue_date: string | null
          notes: string | null
          tax_amount: number | null
          document_type_id: string | null
          account_id: string | null
          branch_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number: string
          client_id: string
          organization_id: string
          subtotal: number
          discount_percentage?: number | null
          discount_amount?: number | null
          tax: number
          total: number
          balance?: number | null
          status?: string
          due_date: string
          issue_date?: string | null
          notes?: string | null
          tax_amount?: number | null
          document_type_id?: string | null
          account_id?: string | null
          branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          client_id?: string
          organization_id?: string
          subtotal?: number
          discount_percentage?: number | null
          discount_amount?: number | null
          tax?: number
          total?: number
          balance?: number | null
          status?: string
          due_date?: string
          issue_date?: string | null
          notes?: string | null
          tax_amount?: number | null
          document_type_id?: string | null
          account_id?: string | null
          branch_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      quotes: {
        Row: {
          id: string
          organization_id: string
          client_id: string
          quote_number: string
          issue_date: string
          valid_until: string
          subtotal: number
          tax_amount: number
          total: number
          notes: string | null
          terms: string | null
          status: string | null
          created_at: string
          updated_at: string
          tax: number
          branch_id: string | null
        }
        Insert: {
          id?: string
          organization_id: string
          client_id: string
          quote_number: string
          issue_date: string
          valid_until: string
          subtotal: number
          tax_amount: number
          total: number
          notes?: string | null
          terms?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
          tax?: number
          branch_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string
          client_id?: string
          quote_number?: string
          issue_date?: string
          valid_until?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          notes?: string | null
          terms?: string | null
          status?: string | null
          created_at?: string
          updated_at?: string
          tax?: number
          branch_id?: string | null
        }
      }
      expenses: {
        Row: {
          id: string
          organization_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          receipt_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          category: string
          description: string
          amount: number
          expense_date: string
          receipt_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          category?: string
          description?: string
          amount?: number
          expense_date?: string
          receipt_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number | null
          description: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price?: number | null
          description?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          total_price?: number | null
          description?: string | null
        }
      }
      quote_items: {
        Row: {
          id: string
          quote_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
        }
        Insert: {
          id?: string
          quote_id: string
          product_id: string
          quantity: number
          unit_price: number
          total_price: number
        }
        Update: {
          id?: string
          quote_id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          total_price?: number
        }
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          client_id: string
          amount: number
          payment_date: string
          notes: string | null
          created_at: string
          organization_id: string
          account_id: string | null
        }
        Insert: {
          id?: string
          invoice_id: string
          client_id: string
          amount: number
          payment_date: string
          notes?: string | null
          created_at?: string
          organization_id: string
          account_id?: string | null
        }
        Update: {
          id?: string
          invoice_id?: string
          client_id?: string
          amount?: number
          payment_date?: string
          notes?: string | null
          created_at?: string
          organization_id?: string
          account_id?: string | null
        }
      }
      document_types: {
        Row: {
          id: string
          organization_id: string
          name: string
          prefix: string
          sequence_next_value: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          prefix: string
          sequence_next_value?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          prefix?: string
          sequence_next_value?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      general_income: {
        Row: {
          id: string
          organization_id: string
          account_id: string
          description: string
          amount: number
          category: string
          income_date: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          account_id: string
          description: string
          amount: number
          category: string
          income_date: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          account_id?: string
          description?: string
          amount?: number
          category?: string
          income_date?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      branches: {
        Row: {
          id: string
          organization_id: string
          name: string
          code: string
          address: string | null
          phone: string | null
          email: string | null
          is_main: boolean | null
          is_active: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          name: string
          code: string
          address?: string | null
          phone?: string | null
          email?: string | null
          is_main?: boolean | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          name?: string
          code?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          is_main?: boolean | null
          is_active?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_settings: {
        Row: {
          id: string
          organization_id: string
          inventory_enabled: boolean | null
          low_stock_threshold: number | null
          auto_deduct_on_invoice: boolean | null
          require_stock_validation: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          inventory_enabled?: boolean | null
          low_stock_threshold?: number | null
          auto_deduct_on_invoice?: boolean | null
          require_stock_validation?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          inventory_enabled?: boolean | null
          low_stock_threshold?: number | null
          auto_deduct_on_invoice?: boolean | null
          require_stock_validation?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_stock: {
        Row: {
          id: string
          product_id: string
          branch_id: string
          quantity: number
          reserved_quantity: number
          min_stock: number | null
          max_stock: number | null
          cost_price: number | null
          last_movement_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          branch_id: string
          quantity?: number
          reserved_quantity?: number
          min_stock?: number | null
          max_stock?: number | null
          cost_price?: number | null
          last_movement_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          branch_id?: string
          quantity?: number
          reserved_quantity?: number
          min_stock?: number | null
          max_stock?: number | null
          cost_price?: number | null
          last_movement_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_movements: {
        Row: {
          id: string
          product_id: string
          branch_id: string
          movement_type: string
          quantity: number
          previous_quantity: number
          new_quantity: number
          reference_type: string | null
          reference_id: string | null
          cost_price: number | null
          notes: string | null
          user_id: string | null
          movement_date: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          branch_id: string
          movement_type: string
          quantity: number
          previous_quantity?: number
          new_quantity?: number
          reference_type?: string | null
          reference_id?: string | null
          cost_price?: number | null
          notes?: string | null
          user_id?: string | null
          movement_date?: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          branch_id?: string
          movement_type?: string
          quantity?: number
          previous_quantity?: number
          new_quantity?: number
          reference_type?: string | null
          reference_id?: string | null
          cost_price?: number | null
          notes?: string | null
          user_id?: string | null
          movement_date?: string
          created_at?: string
        }
      }
      inventory_transfers: {
        Row: {
          id: string
          organization_id: string
          from_branch_id: string
          to_branch_id: string
          transfer_number: string
          status: string | null
          transfer_date: string
          notes: string | null
          created_by: string
          completed_by: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          from_branch_id: string
          to_branch_id: string
          transfer_number: string
          status?: string | null
          transfer_date?: string
          notes?: string | null
          created_by: string
          completed_by?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          from_branch_id?: string
          to_branch_id?: string
          transfer_number?: string
          status?: string | null
          transfer_date?: string
          notes?: string | null
          created_by?: string
          completed_by?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      inventory_transfer_items: {
        Row: {
          id: string
          transfer_id: string
          product_id: string
          quantity: number
          cost_price: number | null
          created_at: string
        }
        Insert: {
          id?: string
          transfer_id: string
          product_id: string
          quantity: number
          cost_price?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          transfer_id?: string
          product_id?: string
          quantity?: number
          cost_price?: number | null
          created_at?: string
        }
      }
    }
  }
}