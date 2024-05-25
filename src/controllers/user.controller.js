import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import { ApiResponse } from '../utils/ApiResponse.js';



const generateAccessAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        // if (!user) {
        //     throw new ApiError(404, "User does not exist")
        // }
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false }) // As we are only updating only one field

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res, next) => {
    // console.log(req)

    // Get User Details
    const { userName, email, fullName, password } = req.body;
    // console.log(userName + "--" + email);

    // Validate Data
    if ([userName, email, fullName, password].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "All fields are required")
    }

    // Check If User Already Exist
    // User.findOne({email})
    const existedUser = await User.findOne({
        $or: [{ userName }, { email }]
    })
    if (existedUser) {
        throw new ApiError(409, "User with same email or username already exits.")
    }

    // Check For Images and Avatar
    // console.log(req.files?.avatar[0]?.path)

    // files: [Object: null prototype] {
    //     avatar: [ [Object] ],
    //     coverImage: [ [Object] ]
    //   },
    const avatarLocalPath = req.files?.avatar?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.coverImage[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required");
    }

    // Upload to Cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath);

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);


    if (!avatar) {
        throw new ApiError(400, "Avatar image is mandatory");
    }

    // Create User Object - create entry in DB
    const user = await User.create({
        userName: userName.toLowerCase(),
        email,
        fullName,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    })


    // Remove Password and Refresh Token Field From Response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    // Check For User Creation
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    // Return Response
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered sucessfully")
    );
})

const loginUser = asyncHandler(async (req, res) => {
    // req.body -> data
    const { username, email, password } = req.body;

    if (!(email || username)) {
        throw new ApiError(400, "Username or Email is required")
    }
    // username or email
    // Find user 
    // const user = User.findOne({email})
    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    // password check
    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid User credential")
    }

    // access and refresh token
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    // send cookie

    const options = {
        httpOnly: true,
        // secure: true //cookie will only be sent to the https:// not http:// path,
    } // By default cookie can be modified by frontend but by pasing these options cookie can only be modified from the server, not frontend

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken // we are sending access and refresh token again apart from cookie as if user is consuming this API from mobile
                },
                "User logged In Successfully"
            )
        )

})

const logoutUser = asyncHandler( async (req, res) =>{
// start here
const userId = req.user?._id // coming from middleware

await User.findByIdAndUpdate(
    userId,
    {
        $set: {
            refreshToken: undefined
        }
    },
    {
        new: true
    } // new value will be returned
)

const options = {
    httpOnly: true,
    secure: true
}

return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out"))

})

export { registerUser, loginUser, logoutUser };