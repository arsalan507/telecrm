// models/SupabaseUser.js - User model for Supabase/PostgreSQL
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../config/supabase');

class SupabaseUser {
  constructor(data) {
    Object.assign(this, data);
  }

  // Static methods for database operations
  static async findById(id) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data ? new SupabaseUser(data) : null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  static async findByEmail(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data ? new SupabaseUser(data) : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  static async create(userData) {
    try {
      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const userToInsert = {
        first_name: userData.firstName || userData.first_name,
        last_name: userData.lastName || userData.last_name,
        email: userData.email.toLowerCase(),
        password_hash: hashedPassword,
        phone: userData.phone,
        organization_id: userData.organizationId || userData.organization_id,
        organization_name: userData.organizationName || userData.organization_name,
        role: userData.role || 'org_admin',
        permissions: userData.permissions || [],
        subscription_plan: userData.subscriptionPlan || userData.subscription_plan || 'free',
        call_limit: userData.callLimit || userData.call_limit || 50,
        calls_used: userData.callsUsed || userData.calls_used || 0,
        signup_source: userData.signupSource || userData.signup_source || 'web',
        is_active: userData.is_active !== undefined ? userData.is_active : true,
        login_count: 0
      };

      const { data, error } = await supabase
        .from('users')
        .insert([userToInsert])
        .select()
        .single();

      if (error) throw error;
      return new SupabaseUser(data);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  static async findByOrganization(organizationId, includeInactive = false) {
    try {
      let query = supabase
        .from('users')
        .select('*')
        .eq('organization_id', organizationId);

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data.map(user => new SupabaseUser(user));
    } catch (error) {
      console.error('Error finding users by organization:', error);
      return [];
    }
  }

  static async countByOrganization(organizationId) {
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error counting users:', error);
      return 0;
    }
  }

  static async getAllUsers(filters = {}) {
    try {
      let query = supabase.from('users').select(`
        *,
        organizations!inner(
          id,
          name,
          subscription_plan
        )
      `);

      // Apply filters
      if (filters.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }
      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }
      if (filters.organizationId && filters.organizationId !== 'all') {
        query = query.eq('organization_id', filters.organizationId);
      }

      // Pagination
      if (filters.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      // Sorting
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      return data.map(user => new SupabaseUser(user));
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  // Instance methods
  async save() {
    try {
      const updateData = {
        first_name: this.first_name,
        last_name: this.last_name,
        email: this.email,
        phone: this.phone,
        organization_name: this.organization_name,
        role: this.role,
        permissions: this.permissions,
        is_active: this.is_active,
        login_count: this.login_count,
        last_login_at: this.last_login_at,
        login_history: this.login_history,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', this.id)
        .select()
        .single();

      if (error) throw error;
      Object.assign(this, data);
      return this;
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async comparePassword(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.password_hash);
    } catch (error) {
      console.error('Password comparison error:', error);
      return false;
    }
  }

  generateAuthToken() {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is not set');
    }
    
    return jwt.sign(
      { 
        userId: this.id, 
        email: this.email, 
        role: this.role,
        organizationId: this.organization_id,
        organizationName: this.organization_name
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  async updateLastLogin(ipAddress = 'unknown', userAgent = 'unknown') {
    try {
      const now = new Date().toISOString();
      
      // Update login tracking
      this.last_login_at = now;
      this.login_count = (this.login_count || 0) + 1;
      
      // Add to login history
      const loginEntry = {
        timestamp: now,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      };
      
      this.login_history = this.login_history || [];
      this.login_history.unshift(loginEntry);
      
      // Keep only last 50 entries
      if (this.login_history.length > 50) {
        this.login_history = this.login_history.slice(0, 50);
      }

      return await this.save();
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  }

  // Virtual properties
  get fullName() {
    return `${this.first_name} ${this.last_name}`;
  }

  get name() {
    return this.fullName;
  }

  // Permission methods
  hasPermission(permission) {
    if (this.role === 'super_admin') return true;
    return this.permissions && this.permissions.includes(permission);
  }

  hasAnyPermission(permissions) {
    if (this.role === 'super_admin') return true;
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAllPermissions(permissions) {
    if (this.role === 'super_admin') return true;
    return permissions.every(permission => this.hasPermission(permission));
  }

  canAccessOrganization(organizationId) {
    return this.role === 'super_admin' || 
           this.organization_id === organizationId;
  }

  // Convert to safe profile (remove sensitive data)
  toSafeProfile() {
    const profile = { ...this };
    delete profile.password_hash;
    delete profile.password_reset_token;
    delete profile.email_verification_token;
    return profile;
  }

  // Convert to API response format
  toJSON() {
    return {
      id: this.id,
      _id: this.id, // For backward compatibility
      firstName: this.first_name,
      lastName: this.last_name,
      fullName: this.fullName,
      name: this.fullName,
      email: this.email,
      phone: this.phone,
      organizationId: this.organization_id,
      organizationName: this.organization_name,
      role: this.role,
      permissions: this.permissions || [],
      isActive: this.is_active,
      loginCount: this.login_count || 0,
      lastLoginAt: this.last_login_at,
      loginHistory: this.login_history || [],
      subscriptionPlan: this.subscription_plan,
      callLimit: this.call_limit,
      callsUsed: this.calls_used,
      createdAt: this.created_at,
      updatedAt: this.updated_at
    };
  }
}

module.exports = SupabaseUser;