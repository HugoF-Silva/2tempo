import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const callRecommendationAPI = async ({ description, location }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/recommend`, {
      description,
      location,
      timestamp: new Date().toISOString(),
      headers: { Authorization: `Bearer ${sessionId}` }
    });
    
    return response.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const fetchHealthCenterStatuses = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health-centers/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch statuses:', error);
    throw error;
  }
};