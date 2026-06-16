import axios from "axios"
import { store } from "../store/store"
import { setLicenseExpired } from "../store/slices/authSlice"

// const API_BASE = "https://localhost:44387";
export const API_BASE = "http://localhost:5262"
//  export const API_BASE = "https://reactapi.advancedmedicentre.com"

export const IMAGE_BASE = `${API_BASE}/uploads/`

const axiosClient = axios.create({
  baseURL: `${API_BASE}/api`,
})


// 🔹 Request Interceptor — attaches JWT token to every request
axiosClient.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem("bteowkeelnl")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 🔹 Response Interceptor — central error handling + auto-logout on 401
axiosClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // If 402 Payment Required, license has expired or is invalid
    if (error.response?.status === 402) {
      store.dispatch(setLicenseExpired({ isExpired: true }))
    }

    // If 401 Unauthorized, clear token and redirect to admin login
    if (error.response?.status === 401) {
      sessionStorage.removeItem("bteowkeelnl")
      // Only redirect if not already on /admin login page
      if (window.location.pathname !== "/admin") {
        window.location.href = "/admin"
      }
    }
    const data = error.response?.data
    const message =
      data && typeof data === "object"
        ? data.message ||
          data.Message ||
          error.message ||
          "Something went wrong"
        : data || error.message || "Something went wrong"

    console.error("API Error:", message)
    return Promise.reject({
      ...(data && typeof data === "object" ? data : {}),
      message,
    })
  }

)

export default axiosClient
