import {
    useQuery,
} from "@tanstack/react-query";

import {
    getCities,
    detectCity,
    fallbackCity,
    selectCity,
} from "../api/locationApi";

function CityModal() {

    const {
        data: cities = [],
    } = useQuery({

        queryKey: ["cities"],

        queryFn: getCities,

    });

    const handleDetectLocation =
        () => {

        navigator
            .geolocation
            .getCurrentPosition(

            async (
                position
            ) => {

                await detectCity(

                    position.coords.latitude,

                    position.coords.longitude
                );

                window.location.reload();

            },

            async () => {

                await fallbackCity();

                window.location.reload();

            }

        );

    };

    const handleSelectCity =
    async (city) => {

        await selectCity(city);

        window.location.reload();

    };

    return (

        <div>

            <button
                onClick={
                    handleDetectLocation
                }
            >
                Detect My Location
            </button>

            {

                cities.map(
                    (city) => (

                    <button
                        key={city}
                        onClick={() =>
                            handleSelectCity(city)
                        }
                    >

                        {city}

                    </button>

                ))

            }

        </div>

    );

}

export default CityModal;