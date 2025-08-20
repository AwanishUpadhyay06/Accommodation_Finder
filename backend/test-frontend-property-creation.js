const axios = require('axios');
require('dotenv').config();

async function testFrontendPropertyCreation() {
  try {
    console.log('🧪 Testing frontend property creation flow...\n');

    // Step 1: Login to get a token (simulate frontend login)
    console.log('Step 1: Logging in to get authentication token...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'awanishupadhyay00@gmail.com', // Use an existing owner account
      password: 'password123' // You may need to adjust this
    });

    if (loginResponse.status !== 200) {
      console.log('❌ Login failed. Please check credentials.');
      return;
    }

    const token = loginResponse.data.token;
    console.log('✅ Login successful, token obtained');

    // Step 2: Create property with the exact same data structure as frontend
    console.log('\nStep 2: Creating property with frontend data structure...');
    
    const propertyData = {
      title: 'Test Property from Frontend Simulation',
      description: 'This is a test property created to debug the server error issue that occurs when adding properties from the frontend.',
      price: 1500,
      location: {
        address: '456 Frontend Test Street',
        city: 'Frontend City',
        state: 'Frontend State'
      },
      propertyType: '2BHK',
      area: 1200,
      bedrooms: 2,
      bathrooms: 2,
      bachelorsAllowed: true,
      furnishingStatus: 'Half',
      features: ['WiFi', 'AC'],
      facilities: ['Gym', 'Parking'],
      availability: 'Available'
    };

    console.log('Property data to be sent:');
    console.log(JSON.stringify(propertyData, null, 2));

    // Step 3: Send POST request to create property
    console.log('\nStep 3: Sending POST request to /api/properties...');
    
    const response = await axios.post('http://localhost:5000/api/properties', propertyData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (response.status === 201) {
      console.log('✅ Property created successfully!');
      console.log('Response:', response.data);
      
      // Clean up - delete the test property
      const propertyId = response.data.property._id;
      await axios.delete(`http://localhost:5000/api/properties/${propertyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('🧹 Test property cleaned up');
    }

  } catch (error) {
    console.error('❌ Error occurred:');
    console.error('Status:', error.response?.status);
    console.error('Status Text:', error.response?.statusText);
    console.error('Response Data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Error Message:', error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Authentication issue - token might be invalid or expired');
    } else if (error.response?.status === 400) {
      console.log('\n💡 Validation error - check the property data format');
    } else if (error.response?.status === 500) {
      console.log('\n💡 Server error - check the backend logs for detailed error information');
    }
  }
}

// Run the test
testFrontendPropertyCreation();
