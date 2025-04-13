// Validators for forum data and post content

exports.validateForumData = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 3) {
    errors.push({ field: 'name', message: 'Name must be at least 3 characters long' });
  }

  if (data.displayOrder && isNaN(data.displayOrder)) {
    errors.push({ field: 'displayOrder', message: 'Display order must be a number' });
  }

  return errors;
};

exports.validatePostData = (data) => {
  const errors = [];

  if (!data.content || data.content.trim().length < 10) {
    errors.push({ field: 'content', message: 'Content must be at least 10 characters long' });
  }

  return errors;
};