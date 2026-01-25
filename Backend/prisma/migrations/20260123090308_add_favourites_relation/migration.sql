-- AddForeignKey
ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
