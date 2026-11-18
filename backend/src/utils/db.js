'use strict';

/** Returns `data` from a supabase-js response, or throws its error for the error middleware. */
exports.unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const PAGE = 1000; // PostgREST returns at most 1000 rows per request

/**
 * Reads every row of a query, page by page, so results are never silently cut off at 1000.
 * @param {() => import('@supabase/supabase-js').PostgrestFilterBuilder} makeQuery builds a fresh query each call
 */
exports.fetchAll = async (makeQuery) => {
  const all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) return all;
  }
};
