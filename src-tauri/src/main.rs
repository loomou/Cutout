#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use base64::{Engine as _, engine::{self, general_purpose}, alphabet};
use reqwest::multipart;
use rfd::AsyncFileDialog;
use tokio::io::AsyncReadExt;

const CUSTOM_ENGINE: engine::GeneralPurpose =
    engine::GeneralPurpose::new(&alphabet::STANDARD, general_purpose::PAD);

#[derive(Serialize)]
struct ImageParam {
    image_base64: String,
    image_path: String,
}

/** 图片转换对象，包含base64 和 图片根路径 */
fn image_to_base64(save_path: String) -> Result<ImageParam, String> {
    // 打开文件
    let mut file = match File::open(&save_path) {
        Ok(file) => file,
        Err(err) => {
            return Err(format!("{:?}", err));
        }
    };

    println!("{:?}", Path::new(&save_path).extension().unwrap().to_str().unwrap().to_string());

    // 存放读取文件
    let mut buffer = Vec::new();
    return match file.read_to_end(&mut buffer) {
        Ok(_) => {
            // 读取的内容转换成 base64
            let base64_image = CUSTOM_ENGINE.encode(&buffer);
            let mine_type = Path::new(&save_path).extension().unwrap().to_str().unwrap().to_string();
            let base64_with_prefix = format!("data:image/{};base64,{}", mine_type, base64_image);
            Ok(ImageParam {
                image_base64: base64_with_prefix,
                image_path: save_path,
            })
        }
        Err(err) => {
            println!("err = {:?}", err);
            Err(format!("{:?}", err))
        }
    };
}

/** 本地打开图像 */
#[tauri::command(async)]
async fn open_image() -> Result<ImageParam, String> {
    // 打开图片
    let file = AsyncFileDialog::new()
        .add_filter("image", &["png", "jpeg", "jpg"])
        .set_directory("/")
        .pick_file()
        .await;

    return match file {
        None => Ok(ImageParam {
            image_path: String::from(""),
            image_base64: String::from(""),
        }),
        _ => {
            let image_path = file.unwrap().path().to_str().unwrap().to_string();
            image_to_base64(image_path)
        }
    };
}


#[tauri::command(async)]
async fn matting_image(file_path: String, save_path: String, api_key: String) -> Result<ImageParam, String> {
    println!("开始抠图：{:?}", file_path);
    let mut file = tokio::fs::File::open(&file_path).await.unwrap();

    let mut contents = Vec::new();

    let file_extension = Path::new(&file_path).extension().unwrap().to_str().unwrap().to_string();

    // 读取文件内容
    let _ = file.read_to_end(&mut contents).await;

    // 构建 multipart form data
    let form = multipart::Form::new()
        .part(
            "image_file",
            multipart::Part::bytes(contents).file_name("file.".to_string() + &file_extension),
        )
        .text("size", "auto");

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.remove.bg/v1.0/removebg")
        .header("X-Api-Key", api_key)
        .multipart(form)
        .send()
        .await;

    println!("{:?}", &response);

    return match response {
        Ok(res) => {
            if res.status() == 403 {
                return Err(403.to_string());
            }
            // 从响应中获取图片数据
            let image_data = res.bytes().await.unwrap();
            //获取项目目录
            println!("save:{:?}", save_path);
            // 将图片数据保存到文件
            let time = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis().to_string();
            let save = save_path.to_string() + &"//".to_string() + &*time + &".".to_string() + &file_extension;
            let mut file = File::create(&save).unwrap();
            let _ = file.write_all(&image_data);
            println!("保存成功!");
            image_to_base64(save)
        }
        Err(err) => {
            println!("{:?}", err);
            Err(format!("{:?}", err))
        }
    };
}

#[tauri::command(async)]
async fn save_matting_image_path() -> String {
    println!("选择保存路径");
    let save_path = AsyncFileDialog::new()
        .set_directory("/")
        .pick_folder()
        .await;
    save_path.unwrap().path().to_str().unwrap().to_string()
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![open_image, matting_image, save_matting_image_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
