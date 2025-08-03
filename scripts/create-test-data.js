// scripts/create-test-data.js - Create test data in Supabase
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const TEST_DATA = {
  organizations: [
    {
      name: 'Blackarrowtechnologies',
      description: 'Blackarrowtechnologies - CallTracker Pro Organization',
      subscription_plan: 'free',
      subscription_status: 'active',
      user_limit: 5,
      call_limit: 50,
      contact_limit: 100,
      team_limit: 1,
      features: {
        advancedAnalytics: false,
        customBranding: false,
        apiAccess: false,
        prioritySupport: false,
        dataExport: true,
        teamManagement: true,
        callRecording: false,
        integrations: false
      },
      settings: {
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
        currency: 'USD',
        language: 'en'
      },
      is_active: true
    },
    {
      name: 'Demo Organization',
      description: 'Demo Organization for testing',
      subscription_plan: 'pro',
      subscription_status: 'active',
      user_limit: 25,
      call_limit: 1000,
      contact_limit: 1000,
      team_limit: 5,
      is_active: true
    }
  ],
  
  users: [
    {
      first_name: 'Super',
      last_name: 'Admin',
      email: 'adminpro@ctp.com',
      password: 'Admin@123',
      role: 'super_admin',
      is_active: true,
      login_count: 0
    },
    {
      first_name: 'Anas',
      last_name: 'User',
      email: 'anas@anas.com',
      password: 'Anas@1234',
      role: 'org_admin',
      is_active: true,
      login_count: 0
    },
    {
      first_name: 'Test',
      last_name: 'Manager',
      email: 'manager@demo.com', 
      password: 'Manager@123',
      role: 'manager',
      is_active: true,
      login_count: 0
    }
  ]
};

class TestDataCreator {
  constructor() {
    this.orgMapping = {};
    this.stats = {
      organizations: { created: 0, errors: 0 },
      users: { created: 0, errors: 0 }
    };
  }

  async createOrganizations() {
    console.log('\n🏢 Creating test organizations...');
    
    for (const org of TEST_DATA.organizations) {
      try {
        // Check if organization already exists
        const { data: existing } = await supabase
          .from('organizations')
          .select('id')
          .eq('name', org.name)
          .single();
        
        if (existing) {
          console.log(`⏭️  Organization '${org.name}' already exists`);
          this.orgMapping[org.name] = existing.id;
          continue;
        }

        const { data, error } = await supabase
          .from('organizations')
          .insert([org])
          .select()
          .single();

        if (error) throw error;

        this.orgMapping[org.name] = data.id;
        this.stats.organizations.created++;
        console.log(`✅ Created organization: ${org.name} (${data.id})`);

      } catch (error) {
        this.stats.organizations.errors++;
        console.error(`❌ Error creating organization '${org.name}':`, error.message);
      }
    }
  }

  async createUsers() {
    console.log('\n👥 Creating test users...');
    
    for (const [index, user] of TEST_DATA.users.entries()) {
      try {
        // Check if user already exists
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (existing) {
          console.log(`⏭️  User '${user.email}' already exists`);
          continue;
        }

        // Hash password
        const password_hash = await bcrypt.hash(user.password, 12);
        
        // Assign organization
        let organization_id = null;
        let organization_name = null;
        
        if (index === 0) {
          // Super admin - no specific organization
          organization_name = 'System';
        } else if (index === 1) {
          // Anas user - Blackarrowtechnologies
          organization_id = this.orgMapping['Blackarrowtechnologies'];
          organization_name = 'Blackarrowtechnologies';
        } else {
          // Other users - Demo Organization
          organization_id = this.orgMapping['Demo Organization'];
          organization_name = 'Demo Organization';
        }

        const userData = {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          password_hash,
          role: user.role,
          organization_id,
          organization_name,
          is_active: user.is_active,
          login_count: user.login_count,
          subscription_plan: 'free',
          call_limit: 50,
          calls_used: 0,
          signup_source: 'web'
        };

        const { data, error } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single();

        if (error) throw error;

        // Update organization owner if this is org admin
        if (organization_id && user.role === 'org_admin') {
          await supabase
            .from('organizations')
            .update({ 
              owner_id: data.id,
              owner_email: data.email 
            })
            .eq('id', organization_id);
        }

        this.stats.users.created++;
        console.log(`✅ Created user: ${user.email} (${data.id})`);

      } catch (error) {
        this.stats.users.errors++;
        console.error(`❌ Error creating user '${user.email}':`, error.message);
      }
    }
  }

  async createTestData() {
    console.log('🚀 Creating test data in Supabase...');
    
    try {
      // Test connection
      const { data, error } = await supabase
        .from('organizations')
        .select('count')
        .limit(1);
      
      if (error && error.code !== 'PGRST116') {
        throw new Error(`Supabase connection failed: ${error.message}`);
      }
      
      console.log('✅ Supabase connection verified');

      // Create data
      await this.createOrganizations();
      await this.createUsers();

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('❌ Test data creation failed:', error);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📊 Test Data Creation Summary:');
    console.log('==============================');
    console.log(`Organizations: ${this.stats.organizations.created} created, ${this.stats.organizations.errors} errors`);
    console.log(`Users: ${this.stats.users.created} created, ${this.stats.users.errors} errors`);
    console.log('==============================');
    console.log('✅ Test data creation completed!');
    
    console.log('\n🔐 Test Login Credentials:');
    console.log('Super Admin: adminpro@ctp.com / Admin@123');
    console.log('Org Admin: anas@anas.com / Anas@1234');
    console.log('Manager: manager@demo.com / Manager@123');
  }
}

// Run if called directly
if (require.main === module) {
  const creator = new TestDataCreator();
  creator.createTestData()
    .then(() => {
      console.log('🎉 Test data creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test data creation failed:', error);
      process.exit(1);
    });
}

module.exports = TestDataCreator;