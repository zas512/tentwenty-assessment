import bcrypt from "bcrypt";

export interface IUser {
  _id?: string;
  googleId?: string;
  email: string;
  name?: string;
  password?: string;
  photo?: string;
  stripe_customer_id?: string | null;
  subscription_type?: string;
  otp?: string | null;
  otp_expiry?: Date;
  is_verified?: boolean;
  credits?: number;
  role?: "user" | "admin";
  membershipName?: string;
  reset_password_token?: string;
  reset_password_expires?: Date;
  oauthProvider?: string;
  last_transaction_id?: string;
  last_transaction_date?: Date;
}

// Mongoose schema
const UserSchema: Schema = new Schema<IUser>({
  googleId: { type: String, unique: true, sparse: true },
  oauthProvider: { type: String },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String
  },
  password: {
    type: String,
    default: ""
  },
  photo: {
    type: String
  },
  stripe_customer_id: {
    type: String,
    default: null
  },
  subscription_type: {
    type: String,
    default: "free"
  },
  otp: {
    type: String,
    default: null
  },
  otp_expiry: {
    type: Date
  },
  is_verified: {
    type: Boolean,
    default: false
  },
  credits: {
    type: Number,
    default: 2
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user"
  },
  membershipName: {
    type: String
  },
  reset_password_token: {
    type: String
  },
  reset_password_expires: {
    type: Date
  },
  last_transaction_id: {
    type: String
  },
  last_transaction_date: {
    type: Date
  }
});

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (typeof this.password === "string") {
    this.password = await bcrypt.hash(this.password, 15);
  }
  next();
});

const User = mongoose.model<IUser>("User", UserSchema);
export default User;
