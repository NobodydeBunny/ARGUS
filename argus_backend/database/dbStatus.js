let databaseAvailable = false;
let lastDatabaseError = null;
let lastCheckedAt = null;

const setDatabaseStatus = (isAvailable, error = null) => {
  databaseAvailable = isAvailable;
  lastDatabaseError = error ? error.message : null;
  lastCheckedAt = new Date();
};

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