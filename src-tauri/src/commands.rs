use std::path::{PathBuf, Path};
use std::io;
use std::process::Command;

pub fn run_command(command: &str, args: &Vec<&str>, cwd: &Path) -> io::Result<String> {
    Command::new(command)
        .current_dir(cwd)
        .args(args)
        .output()
        .map(|x| String::from_utf8(x.stdout).unwrap())
}

pub fn get_commit_list(file_path: &PathBuf) -> Vec<String> {
    let output = run_command(
        "git", &vec!["--no-pager", "log", "--pretty=format:%h", "--", file_path.to_str().unwrap()],
         file_path.parent().unwrap()
    ).expect("failed to run git log");

    let commits: Vec<String> = output.split("\n").map(String::from).collect();
    // Reverse result
    return commits.into_iter().rev().collect()
}

pub fn get_file_at_version(file_path: &PathBuf, version: &String) -> String {
    run_command(
        "git", &vec!["--no-pager", "show", format!("{}:./{}", version, file_path.file_name().unwrap().to_str().unwrap()).as_str()],
         file_path.parent().unwrap()
    ).expect("failed to run git show")
}

pub fn get_diff(file_path: &PathBuf, before_version: &String, after_version: &String) -> String {
    run_command(
        "git", &vec!["--no-pager", "diff", "-U0", before_version, after_version, "--", file_path.file_name().unwrap().to_str().unwrap()],
         file_path.parent().unwrap()
    ).expect("failed to run git show")
}
