'use strict';

/** Returns `data` from a supabase-js response, or throws its error for the error middleware. */
exports.unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};
