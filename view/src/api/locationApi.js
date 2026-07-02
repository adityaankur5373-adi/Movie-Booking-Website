import api from "./api";

export const getCurrentCity = async () => {
  const { data } = await api.get("/location/current");
  return data.city;
};

export const getCities = async () => {
  const { data } = await api.get("/location/cities");
  return data.cities;
};

export const detectCity = async (
  latitude,
  longitude
) => {
  const { data } = await api.post(
    "/location/current-city",
    {
      latitude,
      longitude,
    }
  );

  return data;
};

export const fallbackCity = async () => {
  const { data } = await api.post(
    "/location/fallback-city"
  );

  return data;
};

export const selectCity = async (city) => {
  const { data } = await api.post(
    "/location/select-city",
    { city }
  );

  return data;
};