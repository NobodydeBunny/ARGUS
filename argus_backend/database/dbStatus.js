// Keep the latest connection result available to the health endpoint.
let databaseAvailable = false;
let lastDatabaseError = null;
let lastCheckedAt = null;

const setDatabaseStatus = (isAvailable, error = null) => {
  databaseAvailable = isAvailable;
  lastDatabaseError = error ? error.message : null;
  lastCheckedAt = new Date();
};

// The server uses this to tell the UI whether saving is currently possible.
const getDatabaseStatus = () => {
  return {
    databaseAvailable,
    lastDatabaseError,
    lastCheckedAt
  };
};

module.exports = {
  setDatabaseStatus,
  getDatabaseStatus
};