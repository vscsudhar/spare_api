import mongoose from 'mongoose';

/**
 * Location Schema for Business / Service Locations
 * 
 * IMPORTANT GEOJSON RULE:
 * MongoDB GeoJSON 'Point' coordinates MUST be stored as:
 * [longitude, latitude]
 * NOT [latitude, longitude].
 */
const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      unique: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Coordinates [longitude, latitude] are required'],
      },
    },
    radiusKm: {
      type: Number,
      default: 20,
      min: [0.01, 'Radius must be greater than 0'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        if (ret.location && Array.isArray(ret.location.coordinates) && ret.location.coordinates.length >= 2) {
          ret.longitude = ret.location.coordinates[0];
          ret.latitude = ret.location.coordinates[1];
        }
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// 2dsphere index for geospatial proximity/radius queries
locationSchema.index({ location: '2dsphere' });

export const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);

export default Location;
