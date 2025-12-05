import { PLANET_RADIUS_METERS, STANDARD_GRAV_PARAM } from './constants';

export const estimateOrbitalParameters = (altitudeMeters: number, velocityMetersPerSecond: number) => {
  if (!Number.isFinite(altitudeMeters) || !Number.isFinite(velocityMetersPerSecond)) {
    return { apoapsis: 0, periapsis: 0 };
  }

  const radius = PLANET_RADIUS_METERS + Math.max(0, altitudeMeters);
  const v = Math.max(0, velocityMetersPerSecond);
  const specificEnergy = v ** 2 / 2 - STANDARD_GRAV_PARAM / radius;

  if (specificEnergy >= 0) {
    const apoapsis = Number.POSITIVE_INFINITY;
    return { apoapsis, periapsis: altitudeMeters };
  }

  const semiMajorAxis = -STANDARD_GRAV_PARAM / (2 * specificEnergy);
  const angularMomentum = v * radius;
  const eccentricityTerm = 1 + (2 * specificEnergy * angularMomentum ** 2) / STANDARD_GRAV_PARAM ** 2;
  const eccentricity = Math.min(0.99, Math.sqrt(Math.max(0, eccentricityTerm)));

  const apoapsis = semiMajorAxis * (1 + eccentricity) - PLANET_RADIUS_METERS;
  const periapsis = Math.max(0, semiMajorAxis * (1 - eccentricity) - PLANET_RADIUS_METERS);

  return { apoapsis, periapsis };
};
