// scripts/create-dummy-users.js - Create comprehensive test users for all roles
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/supabase');

const DUMMY_USERS = [
  // Blackarrowtechnologies Organization Users
  {
    first_name: 'Sarah',
    last_name: 'Manager',
    email: 'sarah.manager@blackarrow.com',
    password: 'Manager@123',
    role: 'manager',
    organization_name: 'Blackarrowtechnologies',
    phone: '9876543210'
  },
  {
    first_name: 'John',
    last_name: 'Agent',
    email: 'john.agent@blackarrow.com', 
    password: 'Agent@123',
    role: 'agent',
    organization_name: 'Blackarrowtechnologies',
    phone: '9876543211'
  },
  {
    first_name: 'Emma',
    last_name: 'Viewer',
    email: 'emma.viewer@blackarrow.com',
    password: 'Viewer@123', 
    role: 'viewer',
    organization_name: 'Blackarrowtechnologies',
    phone: '9876543212'
  },
  {
    first_name: 'David',
    last_name: 'Senior',
    email: 'david.senior@blackarrow.com',
    password: 'Senior@123',
    role: 'manager',
    organization_name: 'Blackarrowtechnologies', 
    phone: '9876543213'
  },
  
  // Demo Organization Users
  {
    first_name: 'Lisa',
    last_name: 'OrgHead',
    email: 'lisa.orghead@demo.com',
    password: 'OrgHead@123',
    role: 'org_admin', 
    organization_name: 'Demo Organization',
    phone: '8765432100'
  },
  {
    first_name: 'Mike',
    last_name: 'TeamLead',
    email: 'mike.teamlead@demo.com',
    password: 'TeamLead@123',
    role: 'manager',
    organization_name: 'Demo Organization',
    phone: '8765432101'
  },
  {
    first_name: 'Anna',
    last_name: 'SalesAgent',
    email: 'anna.sales@demo.com',
    password: 'Sales@123',
    role: 'agent',
    organization_name: 'Demo Organization',
    phone: '8765432102'
  },
  {
    first_name: 'Tom',
    last_name: 'Support',
    email: 'tom.support@demo.com',
    password: 'Support@123',
    role: 'agent',
    organization_name: 'Demo Organization',
    phone: '8765432103'
  },
  {
    first_name: 'Kate',
    last_name: 'Observer',
    email: 'kate.observer@demo.com',
    password: 'Observer@123',
    role: 'viewer',
    organization_name: 'Demo Organization',
    phone: '8765432104'
  }
];

class DummyUserCreator {
  constructor() {
    this.orgMapping = {};
    this.stats = {
      users: { created: 0, errors: 0, skipped: 0 },
      contacts: { created: 0, errors: 0 },
      callLogs: { created: 0, errors: 0 },
      tickets: { created: 0, errors: 0 }
    };
  }

  async getOrganizations() {
    try {
      const { data: organizations, error } = await supabase
        .from('organizations')
        .select('id, name');

      if (error) throw error;

      // Create organization mapping
      organizations.forEach(org => {
        this.orgMapping[org.name] = org.id;
      });

      console.log('📊 Found organizations:', Object.keys(this.orgMapping));
    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      throw error;
    }
  }

  async createUsers() {
    console.log('\n👥 Creating dummy users...');
    
    for (const user of DUMMY_USERS) {
      try {
        // Check if user already exists
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('email', user.email)
          .single();
        
        if (existing) {
          console.log(`⏭️  User '${user.email}' already exists`);
          this.stats.users.skipped++;
          continue;
        }

        // Get organization ID
        const organization_id = this.orgMapping[user.organization_name];
        if (!organization_id) {
          console.log(`❌ Organization '${user.organization_name}' not found for ${user.email}`);
          this.stats.users.errors++;
          continue;
        }

        // Hash password
        const password_hash = await bcrypt.hash(user.password, 12);
        
        const userData = {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          password_hash,
          phone: user.phone,
          organization_id,
          organization_name: user.organization_name,
          role: user.role,
          is_active: true,
          login_count: 0,
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

        this.stats.users.created++;
        console.log(`✅ Created user: ${user.email} (${user.role}) - ${user.organization_name}`);

      } catch (error) {
        this.stats.users.errors++;
        console.error(`❌ Error creating user '${user.email}':`, error.message);
      }
    }
  }

  async createSampleContacts() {
    console.log('\n📞 Creating sample contacts...');
    
    const sampleContacts = [
      {
        first_name: 'Alice',
        last_name: 'Johnson',
        email: 'alice.johnson@example.com',
        phone: '9999888801',
        company: 'TechCorp Ltd',
        status: 'new',
        organization_name: 'Blackarrowtechnologies'
      },
      {
        first_name: 'Bob',
        last_name: 'Smith',
        email: 'bob.smith@example.com', 
        phone: '9999888802',
        company: 'InnoSolutions',
        status: 'contacted',
        organization_name: 'Blackarrowtechnologies'
      },
      {
        first_name: 'Carol',
        last_name: 'Davis',
        email: 'carol.davis@example.com',
        phone: '9999888803',
        company: 'Global Enterprises',
        status: 'qualified',
        organization_name: 'Demo Organization'
      },
      {
        first_name: 'Daniel',
        last_name: 'Wilson',
        email: 'daniel.wilson@example.com',
        phone: '9999888804',
        company: 'StartupXYZ',
        status: 'new',
        organization_name: 'Demo Organization'
      }
    ];

    for (const contact of sampleContacts) {
      try {
        const organization_id = this.orgMapping[contact.organization_name];
        if (!organization_id) continue;

        // Get a user from this organization to assign as creator
        const { data: user } = await supabase
          .from('users')
          .select('id')
          .eq('organization_id', organization_id)
          .limit(1)
          .single();

        if (!user) continue;

        const { data, error } = await supabase
          .from('contacts')
          .insert([{
            first_name: contact.first_name,
            last_name: contact.last_name,
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            status: contact.status,
            organization_id,
            lead_source: 'website',
            assigned_to: user.id,
            created_by: user.id
          }])
          .select()
          .single();

        if (error) throw error;

        this.stats.contacts.created++;
        console.log(`✅ Created contact: ${contact.first_name} ${contact.last_name}`);

      } catch (error) {
        this.stats.contacts.errors++;
        console.error(`❌ Error creating contact:`, error.message);
      }
    }
  }

  async createSampleCallLogs() {
    console.log('\n📞 Creating sample call logs...');
    
    // Get some users and contacts for creating realistic call logs
    const { data: users } = await supabase
      .from('users')
      .select('id, organization_id, first_name, last_name')
      .neq('role', 'super_admin');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, phone, organization_id');

    if (!users?.length || !contacts?.length) {
      console.log('⏭️  No users or contacts found, skipping call logs');
      return;
    }

    const sampleCalls = [
      { type: 'inbound', status: 'completed', duration: 180, notes: 'Customer inquiry about pricing' },
      { type: 'outbound', status: 'completed', duration: 240, notes: 'Follow-up call for proposal' },
      { type: 'inbound', status: 'missed', duration: 0, notes: 'Missed call - need to call back' },
      { type: 'outbound', status: 'completed', duration: 360, notes: 'Product demonstration call' },
      { type: 'inbound', status: 'completed', duration: 120, notes: 'Support request for existing customer' }
    ];

    for (let i = 0; i < sampleCalls.length; i++) {
      try {
        const user = users[i % users.length];
        const contact = contacts.find(c => c.organization_id === user.organization_id) || contacts[0];
        const call = sampleCalls[i];

        const { data, error } = await supabase
          .from('call_logs')
          .insert([{
            organization_id: user.organization_id,
            user_id: user.id,
            contact_id: contact.id,
            phone_number: contact.phone,
            type: call.type,
            status: call.status,
            duration: call.duration,
            summary: `${call.type} call - ${call.status}`,
            notes: call.notes,
            follow_up_required: call.status === 'missed' || call.duration > 300
          }])
          .select()
          .single();

        if (error) throw error;

        this.stats.callLogs.created++;
        console.log(`✅ Created call log: ${call.type} call by ${user.first_name} ${user.last_name}`);

      } catch (error) {
        this.stats.callLogs.errors++;
        console.error(`❌ Error creating call log:`, error.message);
      }
    }
  }

  async createSampleTickets() {
    console.log('\n🎫 Creating sample tickets...');
    
    const { data: users } = await supabase
      .from('users')
      .select('id, organization_id, first_name, last_name')
      .neq('role', 'super_admin');

    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email, phone, organization_id');

    if (!users?.length) {
      console.log('⏭️  No users found, skipping tickets');
      return;
    }

    const sampleTickets = [
      {
        title: 'Follow-up: Pricing inquiry from Alice Johnson',
        description: 'Customer called asking about enterprise pricing. Need to send detailed quote.',
        priority: 'high',
        status: 'open'
      },
      {
        title: 'Product Demo Request',
        description: 'Schedule product demonstration for potential client. They are interested in our CRM features.',
        priority: 'medium', 
        status: 'in_progress'
      },
      {
        title: 'Support: Login Issues',
        description: 'Customer reported unable to login to their dashboard. Need to investigate account status.',
        priority: 'urgent',
        status: 'open'
      },
      {
        title: 'Contract Renewal Discussion',
        description: 'Annual contract expires next month. Schedule call to discuss renewal terms.',
        priority: 'medium',
        status: 'open'
      }
    ];

    for (let i = 0; i < sampleTickets.length; i++) {
      try {
        const user = users[i % users.length];
        const contact = contacts?.find(c => c.organization_id === user.organization_id);
        const ticket = sampleTickets[i];

        const ticketId = `CTP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const { data, error } = await supabase
          .from('tickets')
          .insert([{
            organization_id: user.organization_id,
            ticket_id: ticketId,
            title: ticket.title,
            description: ticket.description,
            priority: ticket.priority,
            status: ticket.status,
            assigned_to: user.id,
            created_by: user.id,
            customer_id: contact?.id,
            customer_email: contact?.email,
            customer_phone: contact?.phone,
            tags: ['sample', 'demo'],
            due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days from now
          }])
          .select()
          .single();

        if (error) throw error;

        this.stats.tickets.created++;
        console.log(`✅ Created ticket: ${ticketId} - ${ticket.title}`);

      } catch (error) {
        this.stats.tickets.errors++;
        console.error(`❌ Error creating ticket:`, error.message);
      }
    }
  }

  async createDummyData() {
    console.log('🚀 Creating comprehensive dummy data for CallTracker Pro...');
    
    try {
      // Step 1: Get organizations
      await this.getOrganizations();

      // Step 2: Create users
      await this.createUsers();

      // Step 3: Create sample contacts
      await this.createSampleContacts();

      // Step 4: Create sample call logs
      await this.createSampleCallLogs();

      // Step 5: Create sample tickets
      await this.createSampleTickets();

      // Print summary
      this.printSummary();

    } catch (error) {
      console.error('❌ Dummy data creation failed:', error);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📊 Dummy Data Creation Summary:');
    console.log('================================');
    console.log(`Users: ${this.stats.users.created} created, ${this.stats.users.skipped} skipped, ${this.stats.users.errors} errors`);
    console.log(`Contacts: ${this.stats.contacts.created} created, ${this.stats.contacts.errors} errors`);
    console.log(`Call Logs: ${this.stats.callLogs.created} created, ${this.stats.callLogs.errors} errors`);
    console.log(`Tickets: ${this.stats.tickets.created} created, ${this.stats.tickets.errors} errors`);
    console.log('================================');
    
    console.log('\n🔐 Test Login Credentials:');
    console.log('==========================');
    console.log('SUPER ADMIN:');
    console.log('  Email: adminpro@ctp.com');
    console.log('  Password: Admin@123');
    console.log('');
    console.log('BLACKARROWTECHNOLOGIES ORG:');
    console.log('  Org Admin: anas@anas.com / Anas@1234');
    console.log('  Manager: sarah.manager@blackarrow.com / Manager@123');
    console.log('  Agent: john.agent@blackarrow.com / Agent@123');
    console.log('  Viewer: emma.viewer@blackarrow.com / Viewer@123');
    console.log('  Senior Manager: david.senior@blackarrow.com / Senior@123');
    console.log('');
    console.log('DEMO ORGANIZATION:');
    console.log('  Org Head: lisa.orghead@demo.com / OrgHead@123');
    console.log('  Team Lead: mike.teamlead@demo.com / TeamLead@123');
    console.log('  Sales Agent: anna.sales@demo.com / Sales@123');
    console.log('  Support Agent: tom.support@demo.com / Support@123');
    console.log('  Observer: kate.observer@demo.com / Observer@123');
    console.log('==========================');
    console.log('✅ Dummy data creation completed!');
  }
}

// Run if called directly
if (require.main === module) {
  const creator = new DummyUserCreator();
  creator.createDummyData()
    .then(() => {
      console.log('🎉 Dummy data creation completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Dummy data creation failed:', error);
      process.exit(1);
    });
}

module.exports = DummyUserCreator;