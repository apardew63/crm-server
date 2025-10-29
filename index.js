import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import rateLimit from "express-rate-limit";
import authRouter from "./routes/authRoutes.js";
import employeeRouter from "./routes/employeeRoutes.js";
import taskRouter from "./routes/taskRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import attendanceRouter from "./routes/attendanceRoutes.js";
import performanceRouter from "./routes/performanceRoutes.js";
import holidayRouter from "./routes/holidayRoutes.js";
import salesRouter from "./routes/salesRoutes.js";
import payrollRouter from "./routes/payrollRoutes.js";
import recruitmentRouter from "./routes/recruitmentRoutes.js";
import projectRouter from "./routes/projectRoutes.js";
// import departmentRouter from './routes/department.js'
// import leaveRouter from './routes/leave.js'
// import settingRouter from './routes/setting.js'
// import dashboardRouter from './routes/dashboard.js'
import database from "./config/database.js";

database.connect();
const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors(
    {
    origin: ["https://infinitum-alpha.vercel.app"],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], 
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true, 
  }
)
);
app.use(compression());
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Logging
app.use(morgan("combined"));

// Body parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Static files
// app.use(express.static('public/uploads'))

// API routes
app.use("/api/auth", authRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/tasks", taskRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/attendance", attendanceRouter);
app.use("/api/performance", performanceRouter);
app.use("/api/holidays", holidayRouter);
app.use("/api/sales", salesRouter);
app.use("/api/payroll", payrollRouter);
app.use("/api/recruitment", recruitmentRouter);
app.use("/api/projects", projectRouter);
// app.use('/api/department', departmentRouter)
// app.use('/api/leave', leaveRouter)
// app.use('/api/setting', settingRouter)
// app.use('/api/dashboard', dashboardRouter)



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
