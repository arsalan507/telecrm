// scripts/migrate-to-supabase.js - MongoDB to Supabase migration script
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

// Import MongoDB models
const User = require('../models/User');
const Organization = require('../models/Organization');

// Migration configuration
const MIGRATION_CONFIG = {
  batchSize: 100,
  dryRun: false, // Set to true for testing
  skipExisting: true
};

class SupabaseMigration {
  constructor() {
    this.stats = {
      organizations: { processed: 0, migrated: 0, errors: 0 },
      users: { processed: 0, migrated: 0, errors: 0 }
    };
  }

  async connectMongoDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async testSupabaseConnection() {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      console.log('✅ Supabase connection verified');
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      throw error;
    }
  }

  async migrateOrganizations() {
    console.log('\n📊 Starting organizations migration...');
    
    try {
      const organizations = await Organization.find({}).lean();
      console.log(`Found ${organizations.length} organizations to migrate`);

      for (const org of organizations) {
        this.stats.organizations.processed++;
        
        try {
          // Check if organization already exists
          if (MIGRATION_CONFIG.skipExisting) {
            const { data: existing } = await supabase
              .from('organizations')
              .select('id')
              .eq('name', org.name)
              .single();
            
            if (existing) {
              console.log(`⏭️  Organization '${org.name}' already exists, skipping`);
              continue;
            }
          }

          const orgData = {
            name: org.name,
            description: org.description,
            owner_id: null, // Will be updated after user migration
            owner_email: org.ownerEmail,
            industry: org.industry,
            website: org.website,
            phone: org.phone,
            address: org.address,
            subscription_plan: org.subscriptionPlan || 'free',
            subscription_status: org.subscriptionStatus || 'active',
            user_limit: org.userLimit || 5,
            call_limit: org.callLimit || 50,
            contact_limit: org.contactLimit || 100,
            team_limit: org.teamLimit || 1,
            settings: org.settings || {},
            branding: org.branding || {},
            billing: org.billing || {},
            features: org.features || {},
            is_active: org.isActive !== false,
            metadata: {
              ...org.metadata,
              mongoId: org._id.toString(),
              migratedAt: new Date().toISOString()
            }
          };

          if (!MIGRATION_CONFIG.dryRun) {
            const { data, error } = await supabase
              .from('organizations')
              .insert([orgData])
              .select()
              .single();

            if (error) throw error;
            
            // Store mapping for later user migration
            this.orgMapping = this.orgMapping || {};
            this.orgMapping[org._id.toString()] = data.id;
          }

          this.stats.organizations.migrated++;
          console.log(`✅ Migrated organization: ${org.name}`);

        } catch (error) {
          this.stats.organizations.errors++;
          console.error(`❌ Error migrating organization '${org.name}':`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Organizations migration failed:', error);
      throw error;
    }
  }

  async migrateUsers() {
    console.log('\n👥 Starting users migration...');
    
    try {
      const users = await User.find({}).lean();
      console.log(`Found ${users.length} users to migrate`);

      for (const user of users) {
        this.stats.users.processed++;
        
        try {
          // Check if user already exists
          if (MIGRATION_CONFIG.skipExisting) {
            const { data: existing } = await supabase
              .from('users')
              .select('id')
              .eq('email', user.email.toLowerCase())
              .single();
            
            if (existing) {
              console.log(`⏭️  User '${user.email}' already exists, skipping`);
              continue;
            }
          }

          // Map organization ID
          let supabaseOrgId = null;
          if (user.organizationId && this.orgMapping) {
            supabaseOrgId = this.orgMapping[user.organizationId.toString()];
          }

          const userData = {
            first_name: user.firstName,
            last_name: user.lastName,
            email: user.email.toLowerCase(),
            password_hash: user.password, // Already hashed in MongoDB
            phone: user.phone,
            organization_id: supabaseOrgId,
            organization_name: user.organizationName,
            role: user.role || 'org_admin',
            permissions: user.permissions || [],
            is_active: user.isActive !== false,
            is_email_verified: user.isEmailVerified || false,
            timezone: user.timezone || 'UTC',
            subscription_plan: user.subscriptionPlan || 'free',
            call_limit: user.callLimit || 50,
            calls_used: user.callsUsed || 0,
            signup_source: user.signupSource || 'web',
            signup_step: user.signupStep || 'completed',
            
            // Login tracking (preserve existing data)
            login_count: user.loginCount || 0,
            last_login_at: user.lastLoginAt || user.lastLogin,
            login_history: user.loginHistory || [],
            
            // Performance data
            ticket_stats: user.ticketStats || {},
            performance_metrics: user.performanceMetrics || {},
            performance_targets: user.performanceTargets || {},
            
            // Metadata
            metadata: {
              mongoId: user._id.toString(),
              migratedAt: new Date().toISOString()
            }
          };

          if (!MIGRATION_CONFIG.dryRun) {
            const { data, error } = await supabase
              .from('users')
              .insert([userData])
              .select()
              .single();

            if (error) throw error;

            // Update organization owner if this user is the owner
            if (supabaseOrgId && user.role === 'super_admin') {
              await supabase
                .from('organizations')
                .update({ owner_id: data.id })
                .eq('id', supabaseOrgId);
            }
          }

          this.stats.users.migrated++;
          console.log(`✅ Migrated user: ${user.email}`);

        } catch (error) {
          this.stats.users.errors++;
          console.error(`❌ Error migrating user '${user.email}':`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ Users migration failed:', error);
      throw error;
    }
  }

  async runMigration() {
    console.log('🚀 Starting MongoDB to Supabase migration...');
    console.log(`Configuration: DryRun=${MIGRATION_CONFIG.dryRun}, SkipExisting=${MIGRATION_CONFIG.skipExisting}`);
    
    try {
      // Step 1: Connect to databases
      await this.connectMongoDB();
      await this.testSupabaseConnection();

      // Step 2: Migrate organizations first
      await this.migrateOrganizations();

      // Step 3: Migrate users
      await this.migrateUsers();

      // Step 4: Print summary
      this.printSummary();

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
      console.log('✅ MongoDB disconnected');
    }
  }

  printSummary() {
    console.log('\n📊 Migration Summary:');
    console.log('====================');
    console.log(`Organizations: ${this.stats.organizations.migrated}/${this.stats.organizations.processed} migrated, ${this.stats.organizations.errors} errors`);
    console.log(`Users: ${this.stats.users.migrated}/${this.stats.users.processed} migrated, ${this.stats.users.errors} errors`);
    console.log('====================');
    
    if (MIGRATION_CONFIG.dryRun) {
      console.log('🔍 This was a DRY RUN - no data was actually migrated');
    } else {
      console.log('✅ Migration completed successfully!');
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  const migration = new SupabaseMigration();
  migration.runMigration()
    .then(() => {
      console.log('🎉 Migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = SupabaseMigration;