import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";

const Releases = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white px-6 md:px-16 lg:px-40 py-16 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-sm p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-blue-600" />
        </div>

        <h1 className="mt-5 text-2xl md:text-3xl font-bold text-gray-900">
          Releases Coming Soon 🚀
        </h1>

        <p className="mt-3 text-sm md:text-base text-gray-600 leading-relaxed">
          We’re working on this feature. Soon you’ll be able to explore upcoming
          movie releases, trailers, and release dates here.
        </p>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition font-semibold text-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>

          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 transition font-semibold text-white"
          >
            Go Home
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-500">Thanks for your patience ❤️</p>
      </div>
    </div>
  );
};

export default Releases;