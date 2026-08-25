const utils = {
  generateId: (prefix, lastId) => {
    if (!lastId) return `${prefix}001`;
    const num = parseInt(String(lastId).replace(prefix, ''), 10) + 1;
    return `${prefix}${String(num).padStart(3, '0')}`;
  },

  formatDate: (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  getWeekDates: (date = new Date()) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: utils.formatDate(monday),
      end: utils.formatDate(sunday),
    };
  },

  calculateHoursDifference: (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return (end - start) / (1000 * 60 * 60);
  },

  pagination: (page = 1, limit = 10) => {
    const l = parseInt(limit, 10);
    const p = parseInt(page, 10);
    const offset = (p - 1) * l;
    return {
      limit: l,
      offset: Math.max(0, offset),
    };
  },

  buildUpdateQuery: (table, data, idField, idValue) => {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(data).forEach((key) => {
      if (data[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(data[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push('updated_at = NOW()');
    values.push(idValue);
    const query = `UPDATE ${table} SET ${fields.join(', ')} WHERE ${idField} = $${paramCount} RETURNING *`;
    return { query, values };
  },

  successResponse: (res, data, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  },

  errorResponse: (res, error, statusCode = 500) => {
    return res.status(statusCode).json({
      success: false,
      error: error?.message || String(error),
    });
  },
};

export default utils;
