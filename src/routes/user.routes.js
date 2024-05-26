import { Router } from "express";
import { loginUser, logoutUser, registerUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile, getWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const userRouter = Router();

userRouter.route("/register").post(
    upload.fields(
        [
            {
                name: "avatar",
                maxCount: 1
            },
            {
                name: "coverImage",
                maxCount: 1
            }
        ]
    ),
    registerUser
)

userRouter.route("/login").post(loginUser)

// Secured Routes
userRouter.route("/logout").post(verifyJWT, logoutUser) // injected middleware - verifyJWT
userRouter.route("/refresh-token").post(verifyJWT, refreshAccessToken)
userRouter.route("/change-password").post(verifyJWT, changeCurrentPassword)
userRouter.route("/current-user").get(verifyJWT, getCurrentUser)
userRouter.route("/update-account").patch(verifyJWT, updateAccountDetails)
userRouter.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
userRouter.route("/cover-image").patch(verifyJWT, upload.single("coverImage"), updateUserCoverImage)
userRouter.route("/c/:username").get(getUserChannelProfile)
userRouter.route("/watch-history").get(verifyJWT, getWatchHistory)

export default userRouter;