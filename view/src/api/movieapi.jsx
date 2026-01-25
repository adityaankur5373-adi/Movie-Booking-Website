import axios from "axios";

const omdbApi = axios.create({
  baseURL: "https://www.omdbapi.com/",
});
export default omdbApi