import React, { useState, useEffect } from "react";
import {
  ChartLineIcon,
  CircleDollarSignIcon,
  PlayCircleIcon,
  UsersIcon,
  StarIcon,
} from "lucide-react";

import Loading from "../components/Loading";
import Title from "../admincomponents/Title";
import BlurCircle from "../components/BlurCircle";
import { dateFormat } from "../lib/dateFormat";
import api from "../api/api";
import { toast } from "react-hot-toast";

const AdminDashboard = () => {
  const currency = import.meta.env.VITE_CURRENCY || "₹";

  const [dashboardData, setDashboard] = useState({
    totalBookings: 0,
    totalRevenue: 0,
    activeShows: [],
    totalUser: 0,
  });

  const [loading, setLoading] = useState(true);

  const dashboardCards = [
    {
      title: "Total Bookings",
      value: dashboardData.totalBookings || "0",
      icon: ChartLineIcon,
    },
    {
      title: "Total Revenue",
      value: `${currency}${dashboardData.totalRevenue ?? 0}`,
      icon: CircleDollarSignIcon,
    },
    {
      title: "active shows",
      value: dashboardData.activeShows.length || "0",
      icon: PlayCircleIcon,
    },
    {
      title: "Total Users",
      value: dashboardData.totalUser || "0",
      icon: UsersIcon,
    },
  ];

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const { data } = await api.get("/admin/dashboard");

      if (data?.success) {
        setDashboard(data.dashboard);
      } else {
        toast.error("Failed to load dashboard");
      }
    } catch (error) {
      console.log(
        "AdminDashboard error:",
        error?.response?.data || error.message
      );
      toast.error(error?.response?.data?.message || "Dashboard load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return !loading ? (
    <>
      <Title text1="Admin" text2="Dashboard" />

      <div className="relative flex flex-wrap gap-4 mt-6">
        <BlurCircle top="-100px" left="0" />

        <div className="flex flex-wrap gap-4 w-full ">
          {dashboardCards.map((card, index) => (
            <div
              key={index}
              className="flex items-center justify-between px-4 py-3 bg-primary/10 border
              border-primary/20 rounded-md max-w-50 w-full"
            >
              <div>
                <h1 className="text-sm">{card.title}</h1>
                <p className="text-x1 font-medium mt-1">{card.value}</p>
              </div>
              <card.icon className="w-6 h-6" />
            </div>
          ))}
        </div>
      </div>

      <p className="mt-10 text-lg font-medium">Active Shows</p>

      <div className="relative flex flex-wrap gap-6 max-w-5xl">
        <BlurCircle top="100px" left="-10p%" />

        {dashboardData.activeShows.map((show) => (
          <div
            key={show.id}
            className="w-55 rounded-lg overflow-hidden h-full pb-3 bg-primary/10 border
            border-primary/20 hover:-translate-y-1 transition duration-300"
          >
            <img
              src={show.movie?.posterPath || ""}
              alt=""
              className="h-60 w-full object-cover"
            />

            <p className="font-medium p-2 truncate">
              {show.movie?.title || "N/A"}
            </p>

            <div className="flex items-center justify-between px-2">
              <p className="text-lg font-medium">
                {currency} {show.seatPrice}
              </p>

              <p className="flex items-center gap-1 text-sm text-gray-400 mt-1 pr-1">
                <StarIcon className="w-4 h-4 primary fill-primary" />
                {(show.movie?.voteAverage || 0).toFixed(1)}
              </p>
            </div>

            <p className="px-2 pt-2 text-sm text-gray-500">
              {dateFormat(show.showDateTime)}
            </p>
          </div>
        ))}
      </div>
    </>
  ) : (
    <Loading />
  );
};

export default AdminDashboard;