// models/SupabaseOrganization.js - Organization model for Supabase/PostgreSQL
const { supabase } = require('../config/supabase');

class SupabaseOrganization {
  constructor(data) {
    Object.assign(this, data);
  }

  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? new SupabaseOrganization(data) : null;
    } catch (error) {
      console.error('Error finding organization by ID:', error);
      return null;
    }
  }

  static async findByName(name) {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .ilike('name', name)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? new SupabaseOrganization(data) : null;
    } catch (error) {
      console.error('Error finding organization by name:', error);
      return null;
    }
  }

  static async create(orgData) {
    try {
      const orgToInsert = {
        name: orgData.name,
        description: orgData.description,
        owner_id: orgData.owner,
        owner_email: orgData.ownerEmail,
        industry: orgData.industry,
        website: orgData.website,
        phone: orgData.phone,
        address: orgData.address,
        subscription_plan: orgData.subscriptionPlan || 'free',
        subscription_status: orgData.subscriptionStatus || 'active',
        user_limit: orgData.userLimit || 5,
        call_limit: orgData.callLimit || 50,
        contact_limit: orgData.contactLimit || 100,
        team_limit: orgData.teamLimit || 1,
        settings: orgData.settings || {},
        branding: orgData.branding || {},
        billing: orgData.billing || {},
        features: orgData.features || {},
        is_active: true,
        metadata: orgData.metadata || {}
      };

      const { data, error } = await supabase
        .from('organizations')
        .insert([orgToInsert])
        .select()
        .single();

      if (error) throw error;
      return new SupabaseOrganization(data);
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  }

  static async getAllOrganizations(filters = {}) {
    try {
      let query = supabase.from('organizations').select('*');

      if (filters.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      if (filters.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      return data.map(org => new SupabaseOrganization(org));
    } catch (error) {
      console.error('Error getting all organizations:', error);
      return [];
    }
  }

  async save() {
    try {
      const updateData = {
        name: this.name,
        description: this.description,
        owner_id: this.owner_id,
        owner_email: this.owner_email,
        industry: this.industry,
        website: this.website,
        phone: this.phone,
        address: this.address,
        subscription_plan: this.subscription_plan,
        subscription_status: this.subscription_status,
        user_limit: this.user_limit,
        call_limit: this.call_limit,
        contact_limit: this.contact_limit,
        team_limit: this.team_limit,
        settings: this.settings,
        branding: this.branding,
        billing: this.billing,
        features: this.features,
        is_active: this.is_active,
        metadata: this.metadata,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;
      Object.assign(this, data);
      return this;
    } catch (error) {
      console.error('Error saving organization:', error);
      throw error;
    }
  }

  // Convert to API response format
  toJSON() {
    return {
      id: this.id,
      _id: this.id, // For backward compatibility
      name: this.name,
      description: this.description,
      owner: this.owner_id,
      ownerEmail: this.owner_email,
      industry: this.industry,
      website: this.website,
      phone: this.phone,
      address: this.address,
      subscriptionPlan: this.subscription_plan,
      subscriptionStatus: this.subscription_status,
      userLimit: this.user_limit,
      callLimit: this.call_limit,
      contactLimit: this.contact_limit,
      teamLimit: this.team_limit,
      settings: this.settings,
      branding: this.branding,
      billing: this.billing,
      features: this.features,
      isActive: this.is_active,
      metadata: this.metadata,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }
}

module.exports = SupabaseOrganization;