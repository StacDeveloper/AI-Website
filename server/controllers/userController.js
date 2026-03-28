import pgsql from "../configs/db.js";

export const GetUserCreations = async (req, res) => {
  try {
    const { userId } = req.auth();
    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }
    const creations =
      await pgsql`SELECT * FROM creations WHERE user_id = ${userId} ORDER BY created_at DESC`;

    return res.status(200).json({ success: true, creations });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
export const GetPublishCreations = async (req, res) => {
  try {
    const creations =
      await pgsql`SELECT * FROM creations WHERE publish = true ORDER BY created_at DESC`;

    return res.status(200).json({ success: true, creations });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
export const ToggleLikeCreation = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { id } = req.body;
    console.log(id);
    const [creation] = await pgsql`SELECT * FROM creations WHERE id = ${id}`;

    if (!creation) {
      return res
        .status(400)
        .json({ success: false, message: "No creation exist with this id" });
    }
    const currentLikes = creation.likes;
    const userIdStr = userId.toString();
    let updatedLikes;
    let message;

    if (currentLikes.includes(userIdStr)) {
      updatedLikes = currentLikes.filter((user) => user !== userIdStr);
      message = "Unliked Creation Successfully";
    } else {
      updatedLikes = [...currentLikes, userIdStr];
      message = "Liked Creation Successfully";
    }

    const forMattedArray = `{${updatedLikes.join(",")}}`;
    const updatedCreation =
      await pgsql`UPDATE creations SET likes = ${forMattedArray}::text[] WHERE id = ${id};`;

    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
