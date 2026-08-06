export const subirACloudinary = async (file) => {
  if (!file) return "";

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "ls6wqdvy");

  try {
    const response = await fetch(
      "https://api.cloudinary.com/v1_1/pldkd8np/image/upload",
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    return data.secure_url || "";
  } catch (error) {
    console.error("Error al subir imagen a Cloudinary:", error);
    return "";
  }
};