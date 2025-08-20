const mongoose = require('mongoose');
require('dotenv').config();

const Property = require('../models/Property');

const fixPropertyCounts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update all properties to ensure they have proper isActive and isVisible fields
    const result = await Property.updateMany(
      { 
        $or: [
          { isActive: { $exists: false } },
          { isVisible: { $exists: false } }
        ]
      },
      { 
        $set: { 
          isActive: true,
          isVisible: true 
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} properties with missing fields`);

    // Show current property counts by owner
    const properties = await Property.aggregate([
      {
        $group: {
          _id: '$owner',
          totalProperties: { $sum: 1 },
          activeProperties: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          visibleProperties: {
            $sum: { $cond: [{ $eq: ['$isVisible', true] }, 1, 0] }
          },
          analyticsProperties: {
            $sum: { 
              $cond: [
                { $and: [{ $eq: ['$isActive', true] }, { $eq: ['$isVisible', true] }] }, 
                1, 
                0
              ]
            }
          }
        }
      }
    ]);

    console.log('\nProperty counts by owner:');
    for (const prop of properties) {
      console.log(`Owner ${prop._id}:`);
      console.log(`  Total: ${prop.totalProperties}`);
      console.log(`  Active: ${prop.activeProperties}`);
      console.log(`  Visible: ${prop.visibleProperties}`);
      console.log(`  Analytics (active + visible): ${prop.analyticsProperties}`);
    }

    console.log('\n✅ Property counts fixed!');
    
  } catch (error) {
    console.error('Error fixing property counts:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

fixPropertyCounts();
