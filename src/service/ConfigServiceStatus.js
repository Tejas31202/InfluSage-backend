import {client} from '../config/Db.js';

export const getAppStatus = async (key='appStatus') => {

  const result = await client.query(
    `SELECT * FROM ins.fn_get_configvalue($1::varchar)`,
    [key]
  );

  const cachedStatus = result.rows[0]?.fn_get_configvalue;
  return cachedStatus;
};