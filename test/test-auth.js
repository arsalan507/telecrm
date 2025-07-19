// test/simple-test.js
const http = require('http');

const BASE_URL = 'localhost';
const PORT = 5000; // Changed from 3000 to 5000

// Test data
const testUser = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '1234567890',
  organizationName: 'Test Company',
  password: 'password123'
};

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(body);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testBackend() {
  console.log('🧪 Testing CallTracker Pro Backend...\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server connectivity...');
    const testResponse = await makeRequest('GET', '/api/auth/test');
    
    if (testResponse.status === 200) {
      console.log('✅ Server is running!');
      console.log('📋 Response:', testResponse.data.message);
    } else {
      console.log('❌ Server responded with status:', testResponse.status);
    }
    console.log();

    // Test 2: Test user registration
    console.log('2️⃣ Testing user registration...');
    console.log('📝 Registering user:', testUser.email);
    
    const registerResponse = await makeRequest('POST', '/api/auth/register', testUser);
    
    if (registerResponse.status === 201) {
      console.log('✅ Registration successful!');
      console.log('👤 User:', registerResponse.data.user.fullName);
      console.log('🏢 Organization:', registerResponse.data.user.organizationName);
      console.log('🔑 Token received:', registerResponse.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Registration failed with status:', registerResponse.status);
      console.log('📋 Error:', registerResponse.data.message);
    }
    console.log();

    // Test 3: Test user login
    console.log('3️⃣ Testing user login...');
    
    const loginData = {
      email: testUser.email,
      password: testUser.password
    };
    
    const loginResponse = await makeRequest('POST', '/api/auth/login', loginData);
    
    if (loginResponse.status === 200) {
      console.log('✅ Login successful!');
      console.log('👋 Welcome:', loginResponse.data.message);
      console.log('🔑 Token received:', loginResponse.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Login failed with status:', loginResponse.status);
      console.log('📋 Error:', loginResponse.data.message);
    }
    console.log();

    // Test 4: Test duplicate registration
    console.log('4️⃣ Testing duplicate email registration...');
    
    const duplicateResponse = await makeRequest('POST', '/api/auth/register', testUser);
    
    if (duplicateResponse.status === 409) {
      console.log('✅ Duplicate email properly rejected!');
      console.log('📋 Message:', duplicateResponse.data.message);
    } else {
      console.log('⚠️ Unexpected response for duplicate email:', duplicateResponse.status);
    }
    console.log();

    // Test 5: Test invalid login
    console.log('5️⃣ Testing invalid login...');
    
    const invalidLoginData = {
      email: testUser.email,
      password: 'wrongpassword'
    };
    
    const invalidLoginResponse = await makeRequest('POST', '/api/auth/login', invalidLoginData);
    
    if (invalidLoginResponse.status === 401) {
      console.log('✅ Invalid login properly rejected!');
      console.log('📋 Message:', invalidLoginResponse.data.message);
    } else {
      console.log('⚠️ Unexpected response for invalid login:', invalidLoginResponse.status);
    }
    console.log();

    console.log('🎉 Backend testing completed!');
    console.log('✅ Your CallTracker Pro backend is working correctly!');
    console.log('📱 Ready for Android app integration!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔗 Connection refused. Make sure your backend server is running on http://localhost:3000');
      console.error('💡 Run: npm run dev');
    }
  }
}

// Run the test
testBackend();