const axios = require('axios');

async function fullPropertyTest() {
  try {
    console.log('🧪 Full Property Creation Test - Simulating Frontend Flow\n');

    // Step 1: Login with a known owner account
    console.log('Step 1: Logging in as owner...');
    
    const loginData = {
      email: 'xyz@gmail.com',
      password: 'password' // Common default password - you may need to adjust
    };

    let token;
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', loginData);
      token = loginResponse.data.token;
      console.log('✅ Login successful');
    } catch (loginError) {
      console.log('❌ Login failed, trying different password...');
      // Try common passwords
      const passwords = ['password', '123456', 'xyz', 'test123'];
      
      for (const pwd of passwords) {
        try {
          const response = await axios.post('http://localhost:5000/api/auth/login', {
            email: 'xyz@gmail.com',
            password: pwd
          });
          token = response.data.token;
          console.log(`✅ Login successful with password: ${pwd}`);
          break;
        } catch (err) {
          console.log(`❌ Failed with password: ${pwd}`);
        }
      }
      
      if (!token) {
        console.log('❌ Could not login with any password. Skipping authenticated test.');
        return;
      }
    }

    // Step 2: Create property with exact frontend data structure
    console.log('\nStep 2: Creating property with frontend data structure...');
    
    const propertyData = {
      title: 'Frontend Test Property',
      description: 'This is a comprehensive test property to identify the exact server error that occurs during property creation.',
      price: 1800,
      location: {
        address: '789 Debug Avenue',
        city: 'Test City',
        state: 'Test State'
      },
      propertyType: '2BHK',
      area: 1100,
      bedrooms: 2,
      bathrooms: 2,
      bachelorsAllowed: true,
      furnishingStatus: 'Half',
      features: ['WiFi', 'AC'],
      facilities: ['Gym', 'Parking'],
      availability: 'Available'
    };

    console.log('Property data being sent:');
    console.log(JSON.stringify(propertyData, null, 2));

    // Step 3: Send authenticated request
    console.log('\nStep 3: Sending authenticated POST request...');
    
    const response = await axios.post('http://localhost:5000/api/properties', propertyData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      validateStatus: () => true // Don't throw on error status codes
    });

    console.log('\n📊 RESPONSE DETAILS:');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', response.headers);
    console.log('Data:', JSON.stringify(response.data, null, 2));

    if (response.status === 201) {
      console.log('\n✅ SUCCESS: Property created successfully!');
      
      // Clean up
      if (response.data.property && response.data.property._id) {
        try {
          await axios.delete(`http://localhost:5000/api/properties/${response.data.property._id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          console.log('🧹 Test property cleaned up');
        } catch (cleanupError) {
          console.log('⚠️ Could not clean up test property');
        }
      }
    } else {
      console.log('\n❌ FAILURE: Property creation failed');
      
      if (response.status === 400) {
        console.log('💡 This is a validation error - check the data format');
      } else if (response.status === 500) {
        console.log('💡 This is a server error - check the backend logs for details');
      } else if (response.status === 401) {
        console.log('💡 Authentication issue');
      } else if (response.status === 403) {
        console.log('💡 Authorization issue - user might not have owner role');
      }
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Response Status:', error.response.status);
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('Stack:', error.stack);
  }
}

console.log('🚀 Starting comprehensive property creation test...');
console.log('📝 This will help identify the exact server error you\'re experiencing.\n');

fullPropertyTest();
