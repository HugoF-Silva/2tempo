export const getStatusColor = (status) => {
  const colors = {
    full: '#dc2626',
    average: '#eab308',
    empty: '#16a34a'
  };
  return colors[status] || colors.average;
};

export const getStatusText = (status) => {
  const texts = {
    full: 'Currently Full',
    average: 'Moderate Wait',
    empty: 'Available Now'
  };
  return texts[status] || texts.average;
};

export const getStatusPriority = (status) => {
  const priorities = {
    empty: 1,
    average: 2,
    full: 3
  };
  return priorities[status] || 2;
};

export const sortByAvailability = (centers) => {
  return [...centers].sort((a, b) => {
    return getStatusPriority(a.status) - getStatusPriority(b.status);
  });
};