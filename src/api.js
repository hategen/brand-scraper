import axios from 'axios';

export const scrape = async (url) => {
  let response;
  try {
    const headers = { 'Access-Control-Allow-Origin': '*' };
    const config = {
      url: `http://localhost:3007/scrape?url=${encodeURIComponent(url)}`,
      method: 'GET',
      timeout: 60000,
      crossdomain: true,
      headers,
    };

    response = await axios(config);

    return { data: response.data };
  } catch (error) {
    if (error.response) {
      response = {
        error: error.response.data,
        status: error.response.status,
      };
    } else {
      response = error;
    }

    throw response;
  }
};
