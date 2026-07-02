import api from "./api";

export const getCurrentCity = async () => {
    const { data } =
        await api.get(
            "/location/current"
        );

    return data.city;
};

export const getCities = async () => {
    const { data } =
        await api.get(
            "/location/cities"
        );

    return data.cities;
};

export const detectCity = async (
    latitude,
    longitude
) => {

    await api.post(
        "/location/current-city",
        {
            latitude,
            longitude,
        }
    );

};

export const fallbackCity =
async () => {

    await api.post(
        "/location/fallback-city"
    );

};

export const selectCity =
async (city) => {

    await api.post(
        "/location/select-city",
        {
            city,
        }
    );

};