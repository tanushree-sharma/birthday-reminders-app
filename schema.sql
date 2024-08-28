CREATE TABLE IF NOT EXISTS birthdays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT NOT NULL
);

INSERT INTO birthdays (name, date) VALUES 
('John Doe', '1990-09-08'),
('Jane Smith', '1985-12-03'),
('Alice Johnson', '1995-08-22');