// Add this to your routes/properties.js file temporarily for debugging

// Debug endpoint to test property creation
router.post('/debug/create', [auth, authorize('owner')], async (req, res) => {
  try {
    console.log('=== DEBUG PROPERTY CREATION ===');
    console.log('User:', JSON.stringify({ id: req.user._id, role: req.user.role }, null, 2));
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Test basic property creation
    const testProperty = {
      title: 'Debug Test Property',
      description: 'This is a debug test property to identify server errors.',
      price: 1000,
      location: {
        address: '123 Debug Street',
        city: 'Debug City',
        state: 'Debug State'
      },
      propertyType: '1BHK',
      area: 500,
      bedrooms: 1,
      bathrooms: 1,
      bachelorsAllowed: false,
      furnishingStatus: 'None',
      features: [],
      facilities: [],
      owner: req.user._id
    };
    
    console.log('Creating test property:', JSON.stringify(testProperty, null, 2));
    
    const property = new Property(testProperty);
    await property.save();
    
    console.log('✅ Property created successfully:', property._id);
    
    // Clean up
    await Property.findByIdAndDelete(property._id);
    console.log('🧹 Test property cleaned up');
    
    res.json({ 
      success: true, 
      message: 'Debug test passed - property creation works',
      user: { id: req.user._id, role: req.user.role }
    });
    
  } catch (error) {
    console.error('=== DEBUG ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    if (error.name === 'ValidationError') {
      console.error('Validation errors:');
      Object.keys(error.errors).forEach(key => {
        console.error(`  - ${key}: ${error.errors[key].message}`);
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: error.message,
      name: error.name,
      details: error.name === 'ValidationError' ? error.errors : undefined
    });
  }
});

module.exports = router;
