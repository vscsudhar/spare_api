import AppError from '../../errors/AppError.js';
import Addresses from './addresses.model.js';
import Location from '../locations/locations.model.js';

/**
 * Calculate the great-circle distance between two points on the Earth's surface using Haversine formula
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in kilometers
 */
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Backend Authoritative Location / Hub Matching:
 * Compares customer coordinates with existing active Location hubs,
 * finds the nearest hub, and evaluates against its configured service radius (default 20 km).
 */
async function findNearestHub(latitude, longitude) {
  if (
    latitude === undefined ||
    latitude === null ||
    longitude === undefined ||
    longitude === null
  ) {
    return {
      locationId: null,
      locationName: null,
      distanceFromLocationKm: null,
      serviceAvailable: false,
      location: null,
    };
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (isNaN(lat) || isNaN(lng)) {
    return {
      locationId: null,
      locationName: null,
      distanceFromLocationKm: null,
      serviceAvailable: false,
      location: null,
    };
  }

  const activeLocations = await Location.find({ isActive: true });
  if (!activeLocations || activeLocations.length === 0) {
    return {
      locationId: null,
      locationName: null,
      distanceFromLocationKm: null,
      serviceAvailable: false,
      location: null,
    };
  }

  let nearest = null;
  let minDistance = Infinity;

  for (const loc of activeLocations) {
    let locLat, locLng;
    if (
      loc.location &&
      Array.isArray(loc.location.coordinates) &&
      loc.location.coordinates.length >= 2
    ) {
      // GeoJSON Point: [longitude, latitude]
      locLng = loc.location.coordinates[0];
      locLat = loc.location.coordinates[1];
    } else if (loc.latitude !== undefined && loc.longitude !== undefined) {
      locLat = loc.latitude;
      locLng = loc.longitude;
    }

    if (locLat !== undefined && locLng !== undefined) {
      const dist = calculateDistanceKm(lat, lng, locLat, locLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = loc;
      }
    }
  }

  if (!nearest) {
    return {
      locationId: null,
      locationName: null,
      distanceFromLocationKm: null,
      serviceAvailable: false,
      location: null,
    };
  }

  const radiusKm = nearest.radiusKm ?? 20;
  const distanceRounded = Math.round(minDistance * 100) / 100;

  if (minDistance <= radiusKm) {
    return {
      locationId: nearest._id,
      locationName: nearest.name,
      distanceFromLocationKm: distanceRounded,
      serviceAvailable: true,
      location: {
        id: nearest._id.toString(),
        name: nearest.name,
        distanceKm: distanceRounded,
      },
    };
  } else {
    return {
      locationId: null,
      locationName: null,
      distanceFromLocationKm: distanceRounded,
      serviceAvailable: false,
      location: null,
    };
  }
}

export const addressesService = {
  /**
   * Get all addresses for a specific user
   */
  getAllForUser: async (userId) => {
    return Addresses.find({ user: userId });
  },

  /**
   * Create new address for user with authoritative backend hub matching
   */
  create: async (userId, data) => {
    const existingCount = await Addresses.countDocuments({ user: userId });

    let isDefault = data.isDefault || false;
    // Auto-make default if it's the first address
    if (existingCount === 0) {
      isDefault = true;
    }

    if (isDefault) {
      // Unset previous defaults
      await Addresses.updateMany({ user: userId }, { isDefault: false });
    }

    const hubMatch = await findNearestHub(data.latitude, data.longitude);

    const addressDoc = await Addresses.create({
      ...data,
      user: userId,
      isDefault,
      latitude: data.latitude !== undefined && data.latitude !== null ? Number(data.latitude) : null,
      longitude: data.longitude !== undefined && data.longitude !== null ? Number(data.longitude) : null,
      locationId: hubMatch.locationId,
      locationName: hubMatch.locationName,
      distanceFromLocationKm: hubMatch.distanceFromLocationKm,
    });

    const result = addressDoc.toObject ? addressDoc.toObject() : addressDoc;
    result.location = hubMatch.location;
    result.serviceAvailable = hubMatch.serviceAvailable;

    return result;
  },

  /**
   * Update address with authoritative backend hub recalculation if coordinates changed
   */
  update: async (userId, addressId, data) => {
    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found.', 404);
    }

    if (data.isDefault) {
      // Unset previous defaults
      await Addresses.updateMany({ user: userId, _id: { $ne: addressId } }, { isDefault: false });
      address.isDefault = true;
    } else if (data.isDefault === false && address.isDefault) {
      const otherAddress = await Addresses.findOne({ user: userId, _id: { $ne: addressId } });
      if (otherAddress) {
        otherAddress.isDefault = true;
        await otherAddress.save();
        address.isDefault = false;
      } else {
        // Only one address left, keep default
        address.isDefault = true;
      }
    }

    const fields = [
      'name',
      'recipientName',
      'phone',
      'addressLine1',
      'addressLine2',
      'city',
      'state',
      'postalCode',
      'country',
    ];

    fields.forEach((field) => {
      if (data[field] !== undefined) {
        address[field] = data[field];
      }
    });

    const latChanged = data.latitude !== undefined && data.latitude !== address.latitude;
    const lngChanged = data.longitude !== undefined && data.longitude !== address.longitude;

    if (data.latitude !== undefined) {
      address.latitude = data.latitude !== null ? Number(data.latitude) : null;
    }
    if (data.longitude !== undefined) {
      address.longitude = data.longitude !== null ? Number(data.longitude) : null;
    }

    let hubMatch;
    if (latChanged || lngChanged || (address.latitude && !address.locationId && !address.distanceFromLocationKm)) {
      hubMatch = await findNearestHub(address.latitude, address.longitude);
      address.locationId = hubMatch.locationId;
      address.locationName = hubMatch.locationName;
      address.distanceFromLocationKm = hubMatch.distanceFromLocationKm;
    } else {
      hubMatch = {
        locationId: address.locationId,
        locationName: address.locationName,
        distanceFromLocationKm: address.distanceFromLocationKm,
        serviceAvailable: !!address.locationId,
        location: address.locationId
          ? {
              id: address.locationId.toString(),
              name: address.locationName,
              distanceKm: address.distanceFromLocationKm,
            }
          : null,
      };
    }

    const savedDoc = await address.save();
    const result = savedDoc.toObject ? savedDoc.toObject() : savedDoc;
    result.location = hubMatch.location;
    result.serviceAvailable = hubMatch.serviceAvailable;

    return result;
  },

  /**
   * Delete address
   */
  delete: async (userId, addressId) => {
    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found.', 404);
    }

    const wasDefault = address.isDefault;
    await Addresses.deleteOne({ _id: addressId, user: userId });

    // If we deleted the default address, make the next available address default
    if (wasDefault) {
      const nextAddress = await Addresses.findOne({ user: userId });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }
  },

  /**
   * Set address as default
   */
  setDefault: async (userId, addressId) => {
    const address = await Addresses.findOne({ _id: addressId, user: userId });
    if (!address) {
      throw new AppError('Address not found.', 404);
    }

    await Addresses.updateMany({ user: userId }, { isDefault: false });
    address.isDefault = true;
    return address.save();
  },
};

export default addressesService;
